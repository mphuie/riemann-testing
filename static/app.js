'use strict';

(function () {
  var app;

  app = angular.module('myapp', ['ui.ace', 'ui.bootstrap', 'firebase', 'toaster']);

  app.controller('MainCtrl', function ($scope, $http, $firebaseArray, toaster) {
    var loopThroughMetrics, ref;
    $scope.metricStatus = '';
    loopThroughMetrics = function loopThroughMetrics(metric, values) {
      var i;
      i = 0;
      while (i < values.length) {
        (function (i) {
          setTimeout(function () {
            console.log(values[i]);
            $scope.metricStatus = $scope.metricStatus + '.';
            $http.post('/send-metric', {
              service: metric,
              metric_f: values[i]
            });
          }, 1000 * i);
        })(i);
        i++;
      }
    };
    $scope.metric = {};
    $scope.metricPath = {};
    ref = firebase.database().ref().child("alerts");
    $scope.alerts = $firebaseArray(ref);
    $http.get('/static/samples.json').then(function (resp) {
      return $scope.sampleConfigs = resp.data;
    });
    $http.get('/containers').then(function (resp) {
      $scope.runningContainers = _.filter(resp.data, function (c) {
        return c.image === 'mphuie/riemann';
      });
      return console.log($scope.runningContainers);
    });
    $scope.setCode = function (config) {
      $scope.config = atob(config.code);
      return $scope.displayedHelpText = config.helpText;
    };
    $scope.sendMetric = function () {
      var values;
      console.log($scope.metric);
      if ($scope.metric.metric_f.indexOf(',') > -1) {
        console.log('comma delim!!!???');
        values = _.map($scope.metric.metric_f.split(','), function (i) {
          return parseInt(i);
        });
        $scope.metricStatus = '';
        return loopThroughMetrics($scope.metric.service, values);
      } else {
        return $http.post('/send-metric', $scope.metric).then(function () {
          return console.log('send!');
        }, function () {
          return toaster.pop('error', 'riemann', 'error in metric!');
        });
      }
    };
    $scope.clearAlerts = function () {
      return $http.delete('https://riemann-tester.firebaseio.com/alerts.json');
    };
    $scope.startRiemann = function () {
      toaster.pop('success', 'riemann', 'starting/restarting riemann...');
      return $http.get('/start-riemann');
    };
    $scope.save = function () {
      toaster.pop('success', 'riemann', 'testing riemann config...');
      $scope.saveOutput = '';
      return $http.post('/generate-config', {
        config: $scope.config
      }).then(function (resp) {
        $scope.saveOutput = resp.data.stdout;
        return $http.get('/start-riemann').then(function () {
          return toaster.pop('success', 'riemann', 'good, restarting riemann!...');
        });
      }, function (resp) {
        $scope.saveOutput = resp.data.stdout;
        return toaster.pop('error', 'riemann', 'config does not validate!');
      });
    };
    return $scope.lookupGraphiteMetric = function () {
      console.log($scope.metricPath);
      return $http.get('http://graphite.tableausandbox.com/render/?target=' + $scope.metricPath.path + '&from=-10minutes&format=json').then(function (resp) {
        var values;
        $scope.metricPath.results = resp.data[0].datapoints;
        values = _.map(resp.data[0].datapoints, function (i) {
          return i[0];
        });
        $scope.metricStatus = '';
        return loopThroughMetrics($scope.metricPath.path, values);
      });
    };
  });
}).call(undefined);
