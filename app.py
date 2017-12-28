from flask import Flask, render_template, request, jsonify, redirect, session, url_for
import jinja2
import docker
from riemann_client.transport import TCPTransport
import riemann_client.client
from models import Config
import requests
from apscheduler.schedulers.background import BackgroundScheduler
import arrow
import os

def cleanup():
  now = arrow.utcnow()
  for container in client.containers.list():
    image = container.attrs['Config']['Image']

    if image == 'mphuie/riemann':
      started =  arrow.get(container.attrs['State']['StartedAt'])
      age = int((now-started).total_seconds())
      image = container.attrs['Config']['Image']
      print(image)
      print('Found container that has been up for {0} seconds'.format(age))

      if age > 1200:
        print('container found older than 20 minutes, removing!')
        container.stop()
        container.remove()


scheduler = BackgroundScheduler()
job = scheduler.add_job(cleanup, 'interval', minutes=45)

scheduler.start()


Config.create_table(fail_silently=True)

client = docker.from_env()
app = Flask(__name__)
app.secret_key = 'wqpdmqevoinwdiuahsd;wokd'

available_ports = list(range(5001,5090))



@app.route('/login', methods=['GET', 'POST'])
def login():
  if request.method == 'GET':
    return render_template('login.html')
  if request.method == 'POST':
    session['username'] = request.form['username']

    for c in client.containers.list():
      port = int(c.attrs['NetworkSettings']['Ports']['5555/tcp'][0]['HostPort'])
      try:
        available_ports.remove(port)
      except ValueError:
        pass

    session['riemann_port'] = available_ports.pop()
    return redirect(url_for('hello'))

@app.route('/logout')
def logout():
  session.pop('username', None)
  return 'ok'

@app.route("/")
def hello():
  if not 'username' in session:
    return redirect(url_for('login'))

  print(session['username'])
  print(session['riemann_port'])

  return render_template('index.html', username=session['username'])

@app.route('/start-riemann')
def start_riemann():
  for container in client.containers.list():
    if container.attrs['Name'] == '/' + session['username']:
      container.exec_run("kill -HUP 1")
      return jsonify({"port": session['riemann_port']})

  config_path = '{0}/{1}.config'.format(os.getcwd(), session['username'])

  volume_bindings = {
    config_path: {
      'bind': '/app/etc/riemann.config',
      'mode': 'rw',
    }
  }

  port_bindings = {
    '5555': int(session['riemann_port'])
  }
  client.containers.run("mphuie/riemann", name=session['username'], volumes=volume_bindings, detach=True, ports=port_bindings)
  return jsonify({ "port": session['riemann_port'] })

@app.route('/containers')
def list_containers():
  containers = []
  for container in client.containers.list():
    containers.append({
      'id': container.id,
      'name': container.name,
      'image': container.attrs['Config']['Image']
      })
  return jsonify(containers)

@app.route('/send-metric', methods=['POST'])
def send_metric():
  print(request.json)

  print(session['username'])
  print(session['riemann_port'])
  with riemann_client.client.Client(TCPTransport('0.0.0.0', int(session['riemann_port']))) as client:
    payload = request.json

    if 'tags' in request.json:
      payload['tags'] = request.json['tags'].split(',')

    if not 'ttl' in payload:
      payload['ttl'] = 60

    if 'metric_f' in payload:
      payload['metric_f'] = float(payload['metric_f'])
    else:
      payload['metric_f'] = 0

    payload['host'] = 'testhost'

    print(payload)
    client.event(**payload)
    # client.event(service="one", metric_f=0.1)

  return jsonify(payload)

@app.route('/generate-test-config', methods=['POST'])
def generate_test_config():
  with open('{0}.config'.format(session['username']), 'w') as fh:
    output = jinja2.Environment(
        loader=jinja2.FileSystemLoader('./')
    ).get_template('config.jinja').render({ 'clause': request.json['config'], 'username': session['username'] })

    fh.write(output)


  config_path = '{0}/{1}.config'.format(os.getcwd(), session['username'])

  print(config_path)
  volume_bindings = {
    config_path: {
      'bind': '/app/etc/riemann.config',
      'mode': 'rw',
    }
  }

  try:
    docker_stdout = client.containers.run("mphuie/riemann-test", volumes=volume_bindings)
  except docker.errors.ContainerError as e:
    return jsonify(stdout=str(e)), 500
  else:
    return jsonify(stdout=docker_stdout.decode("utf-8"))

@app.route('/generate-full-config', methods=['POST'])
def generate_full_config():
  configs = [c.to_dict() for c in Config.select()]
  with open('riemann.config', 'w') as fh:
    output = jinja2.Environment(
        loader=jinja2.FileSystemLoader('./')
    ).get_template('riemann.jinja').render({ 'configs': configs })

    fh.write(output)

  resp = requests.post('http://hmp.tableausandbox.com:8000/riemann-config', json=configs)
  return 'ok'


@app.route('/config-entry')
def get_config_entry():
  return jsonify([c.to_dict() for c in Config.select()])

@app.route('/config-entry/<int:id>', methods=['DELETE'])
def delete_config_entry(id):
  q = Config.delete().where(Config.id == id)
  q.execute()
  return 'ok'

@app.route('/save-config-entry', methods=['POST'])
def save_config_entry():
  print(request.json)

  Config.create(**request.json, contact=session['username'])
  return 'ok'

if __name__ == '__main__':
  app.run(host='0.0.0.0', debug=True)