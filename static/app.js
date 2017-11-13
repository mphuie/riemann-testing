'use strict';

(function () {
  var app;

  app = angular.module('myapp', ['ui.ace', 'ui.bootstrap', 'firebase']);

  app.controller('MainCtrl', function ($scope, $http, $firebaseArray) {
    var ref;
    $scope.metric = {};
    ref = firebase.database().ref().child("alerts");
    $scope.alerts = $firebaseArray(ref);
    // $http
    //   .get '/static/riemann.config'
    //   .then (resp) ->
    //     $scope.config = resp.data
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
      console.log($scope.metric);
      return $http.post('/send-metric', $scope.metric);
    };
    $scope.clearAlerts = function () {
      return $http.delete('https://riemann-tester.firebaseio.com/alerts.json');
    };
    $scope.startRiemann = function () {
      return $http.get('/start-riemann');
    };
    return $scope.save = function () {
      $scope.saveOutput = '';
      return $http.post('/generate-config', {
        config: $scope.config
      }).then(function (resp) {
        return $scope.saveOutput = resp.data.stdout;
      }, function (resp) {
        return $scope.saveOutput = resp.data.stdout;
      });
    };
  });
}).call(undefined);
