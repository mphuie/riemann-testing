from flask import Flask, render_template, request, jsonify
import jinja2
import docker
from riemann_client.transport import TCPTransport
import riemann_client.client
from models import Config
import requests

Config.create_table(fail_silently=True)

client = docker.from_env()
app = Flask(__name__)

volume_bindings = {
  '/Users/mhuie/ResilioSync/learning/riemann-testing/test.config': {
    'bind': '/app/etc/riemann.config',
    'mode': 'rw',
  }
}

port_bindings = {
  '5555': '5555'
}

@app.route("/")
def hello():
  return render_template('index.html')

@app.route('/start-riemann')
def start_riemann():
  for container in client.containers.list():
    if container.attrs['Config']['Image'] == 'mphuie/riemann':
      container.exec_run("kill -HUP 1")
      return "riemann container running, sending HUP!"
  
  client.containers.run("mphuie/riemann", volumes=volume_bindings, detach=True, ports=port_bindings)
  return "riemann container doesnt exist, starting!!"

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

  riemann_host = request.json.pop('riemannHost', 'localhost')


  print('sending to {0}'.format(riemann_host))
  with riemann_client.client.Client(TCPTransport(riemann_host, 5555)) as client:
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

  return jsonify(payload)

@app.route('/generate-test-config', methods=['POST'])
def generate_test_config():
  with open('test.config', 'w') as fh:
    output = jinja2.Environment(
        loader=jinja2.FileSystemLoader('./')
    ).get_template('config.jinja').render({ 'clause': request.json['config']})

    fh.write(output)

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

  Config.create(**request.json)
  return 'ok'

if __name__ == '__main__':
  app.run(debug=True)