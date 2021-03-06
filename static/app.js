// Generated by CoffeeScript 1.10.0
(function() {
  var app;

  app = angular.module('myapp', ['ui.router', 'ui.ace', 'ui.bootstrap', 'firebase', 'toaster']);

  app.filter('stripFirebase', function() {
    return function(value) {
      delete value['$id'];
      delete value['$priority'];
      return value;
    };
  });

  app.config([
    '$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
      $urlRouterProvider.otherwise('/');
      return $stateProvider.state('home', {
        url: '/',
        templateUrl: '/static/partials/editor.html',
        controller: 'MainCtrl'
      }).state('configs', {
        url: '/configs',
        templateUrl: '/static/partials/configs.html',
        controller: 'ConfigCtrl'
      }).state('builder', {
        url: '/builder',
        templateUrl: '/static/partials/builder.html',
        controller: 'BuilderCtrl'
      });
    }
  ]);

  app.controller('ConfigCtrl', function($scope, $http, toaster) {
    console.log('test');
    $http.get('/config-entry').then(function(resp) {
      return $scope.configs = resp.data;
    });
    $scope.buildFullConfig = function() {
      return $http.post('/generate-full-config', {}).then(function() {
        return toaster.pop('success', 'status', 'success!');
      });
    };
    return $scope.deleteConfig = function(id) {
      return $http["delete"]('/config-entry/' + id).then(function() {
        return toaster.pop('success', 'status', 'deleted!');
      });
    };
  });

  app.controller('MainCtrl', function($scope, $http, $firebaseArray, toaster, username) {
    var loopThroughMetrics, loopThroughStates, ref;
    $scope.username = username;
    $scope.metric = {};
    $scope.riemannHosts = ['localhost', 'riemann.hmp.tableausandbox.com', 'riemann.hmp.tableauprod.net'];
    $scope.metricStatus = '';
    loopThroughMetrics = function(metric, values) {
      var i;
      i = 0;
      while (i < values.length) {
        (function(i) {
          setTimeout((function() {
            console.log(metric);
            console.log(values[i]);
            $scope.metricStatus = $scope.metricStatus + '.';
            $http.post('/send-metric', {
              service: metric.service,
              metric_f: values[i],
              state: metric.state,
              tags: metric.tags,
              riemannHost: metric.riemannHost
            });
          }), 1000 * i);
        })(i);
        i++;
      }
    };
    loopThroughStates = function(metric, values) {
      var i;
      console.log(values);
      i = 0;
      while (i < values.length) {
        (function(i) {
          setTimeout((function() {
            console.log(metric);
            console.log(values[i]);
            $scope.metricStatus = $scope.metricStatus + '.';
            $http.post('/send-metric', {
              service: metric.service,
              metric_f: metric.metric_f,
              state: values[i],
              tags: metric.tags,
              riemannHost: metric.riemannHost
            });
          }), 1000 * i);
        })(i);
        i++;
      }
    };
    $scope.metricPath = {
      path: 'qa01_online_10ay.cluster_health.cpu.usage.0001f-chsx01-tableausandbox-com'
    };
    ref = firebase.database().ref().child(username);
    $scope.alerts = $firebaseArray(ref);
    $http.get('/static/samples.json').then(function(resp) {
      return $scope.sampleConfigs = resp.data;
    });
    $http.get('/containers').then(function(resp) {
      $scope.runningContainers = _.filter(resp.data, function(c) {
        return c.image === 'mphuie/riemann';
      });
      return console.log($scope.runningContainers);
    });
    $scope.setCode = function(config) {
      $scope.config = atob(config.code);
      return $scope.displayedHelpText = config.helpText;
    };
    $scope.sendMetric = function() {
      var values;
      $scope.metric.riemannHost = $scope.riemannHosts[$scope.metric.riemannHost];
      console.log($scope.metric);
      if ($scope.metric.state && $scope.metric.state.indexOf(',') > -1) {
        values = _.map($scope.metric.state.split(','), function(i) {
          return i;
        });
        $scope.metricStatus = '';
        return loopThroughStates($scope.metric, values);
      } else if ($scope.metric.metric_f && $scope.metric.metric_f.indexOf(',') > -1) {
        values = _.map($scope.metric.metric_f.split(','), function(i) {
          return parseInt(i);
        });
        $scope.metricStatus = '';
        return loopThroughMetrics($scope.metric, values);
      } else {
        return $http.post('/send-metric', $scope.metric).then(function() {
          return toaster.pop('success', 'riemann', 'metric sent!');
        }, function() {
          return toaster.pop('error', 'riemann', 'error in metric!');
        });
      }
    };
    $scope.clearAlerts = function() {
      return $http["delete"]("https://riemann-tester.firebaseio.com/" + username + ".json");
    };
    $scope.startRiemann = function() {
      toaster.pop('success', 'riemann', 'starting/restarting riemann...');
      return $http.get('/start-riemann');
    };
    $scope.save = function() {
      toaster.pop('success', 'riemann', 'testing riemann config...');
      $scope.saveOutput = '';
      return $http.post('/generate-test-config', {
        config: $scope.config
      }).then(function(resp) {
        $scope.saveOutput = resp.data.stdout;
        return $http.get('/start-riemann').then(function(resp) {
          toaster.pop('success', 'riemann', 'good, restarting riemann!...');
          return $scope.riemannPort = resp.data.port;
        });
      }, function(resp) {
        $scope.saveOutput = resp.data.stdout;
        return toaster.pop('error', 'riemann', 'config does not validate!');
      });
    };
    $scope.lookupGraphiteMetric = function() {
      return $http.get("http://graphite.tableausandbox.com/render/?target=" + $scope.metricPath.path + "&from=-10minutes&format=json").then(function(resp) {
        var values;
        $scope.metricPath.results = resp.data[0].datapoints;
        values = _.map(resp.data[0].datapoints, function(i) {
          return i[0];
        });
        $scope.metricStatus = '';
        $scope.metricPath.service = $scope.metricPath.path;
        return loopThroughMetrics($scope.metricPath, values);
      });
    };
    return $scope.saveConfig = function() {
      var payload;
      payload = {
        entry: $scope.config,
        description: $scope.newConfig.description
      };
      return $http.post('/save-config-entry', payload).then(function(resp) {
        return console.log(payload);
      });
    };
  });

  app.controller('BuilderCtrl', function($scope, $http, $filter) {
    console.log('hi from builder!');
    $scope.newMethod = {};
    $scope.newRule = {};
    $scope.selectMethod = function() {
      return $scope.newMethod.configText = $filter('json')($scope.newMethod.selected.config);
    };
    return $scope.notificationOptions = [
      {
        name: 'Pager Duty',
        "function": 'pagerduty',
        config: {
          routing_key: '940563ab8db246a59e0782677f837e34',
          event_action: 'trigger',
          payload: {
            summary: 'SUMMARY -> {{ description }} / {{ service }} ({{ host}} ) ',
            source: '{{ host }}',
            severity: 'critical'
          }
        }
      }, {
        name: 'Hipchat Direct Message',
        "function": 'hipchatdm',
        config: {
          api_token: 'ktpT6tNErbhXjviQqFOPPP7XCz1FtUoi6obR9Py9',
          notify_email: 'mhuie@tableau.com',
          payload: {
            message: 'test private message',
            notify: false,
            message_format: 'html'
          }
        }
      }, {
        name: 'Hipchat Room notification',
        "function": 'hipchatroom',
        config: {
          api_token: 'ktpT6tNErbhXjviQqFOPPP7XCz1FtUoi6obR9Py9',
          notify_room_id: 4063746,
          payload: {
            message: 'test room notification',
            message_format: 'html',
            from: 'test title',
            color: 'purple',
            notify: false
          }
        }
      }, {
        name: 'Email',
        "function": 'email',
        config: {
          smtpHost: 'mailrelay.tableausandbox.com',
          port: 25,
          secure: false,
          payload: {
            from: 'no-reply@tableausoftware.com',
            to: 'mhuie@tableau.com',
            subject: 'test subject',
            text: 'hello world',
            html: '<b>Hello world!</b>'
          }
        }
      }, $scope.createThresholdRule = function() {
        console.log($scope.newMethod);
        return $http.post('/add-threshold-rule', $scope.newRule).then(function(resp) {
          var payload, ruleId;
          console.log(resp.data);
          ruleId = resp.data.id;
          payload = {
            config: JSON.parse($scope.newMethod.configText),
            "function": $scope.newMethod.selected["function"],
            name: 'Notification for Config id ' + ruleId
          };
          $http.post('http://events.hmp.tableausandbox.com/notification', payload);
          return $http.post('http://events.hmp.tableausandbox.com/rules', [
            {
              path: 'configId',
              type: 'equals',
              value: ruleId
            }
          ]);
        });
      }
    ];
  });

}).call(this);

//# sourceMappingURL=app.js.map
