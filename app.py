from flask import Flask, render_template, request, jsonify
import jinja2
import docker
from riemann_client.transport import TCPTransport
import riemann_client.client

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
    print(container.id)  
    print(container.name)
    print(container.attrs['Config']['Image'])

    containers.append({
      'id': container.id,
      'name': container.name,
      'image': container.attrs['Config']['Image']
      })
  return jsonify(containers)

@app.route('/send-metric', methods=['POST'])
def send_metric():
  with riemann_client.client.Client(TCPTransport('localhost', 5555)) as client:
    payload = request.json

    if not 'ttl' in payload:
      payload['ttl'] = 60

    payload['metric_f'] = float(payload['metric_f'])
    payload['host'] = 'testhost'


    client.event(**payload)

  return jsonify(payload)


    



@app.route('/generate-config', methods=['POST'])
def generate_config():
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

if __name__ == '__main__':
  app.run(debug=True)