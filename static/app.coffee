app = angular.module 'myapp', ['ui.ace', 'ui.bootstrap', 'firebase']

app.controller 'MainCtrl', ($scope, $http, $firebaseArray) ->

  $scope.metric = {}

  ref = firebase.database().ref().child("alerts")
  $scope.alerts = $firebaseArray(ref)


  # $http
  #   .get '/static/riemann.config'
  #   .then (resp) ->
  #     $scope.config = resp.data

  $http
    .get '/static/samples.json'
    .then (resp) ->
      $scope.sampleConfigs = resp.data


  $http
    .get '/containers'
    .then (resp) ->
      $scope.runningContainers = _.filter resp.data, (c) ->
        return c.image == 'mphuie/riemann'

      console.log $scope.runningContainers

  $scope.setCode = (config) ->
    $scope.config = atob(config.code)
    $scope.displayedHelpText = config.helpText

  $scope.sendMetric = ->
    console.log $scope.metric

    $http
      .post '/send-metric', $scope.metric

  $scope.clearAlerts = ->
    $http.delete 'https://riemann-tester.firebaseio.com/alerts.json'

  $scope.startRiemann = ->
    $http.get '/start-riemann'
  $scope.save = ->

    $scope.saveOutput = ''

    $http
      .post '/generate-config', { config: $scope.config }
      .then (resp) ->
        $scope.saveOutput = resp.data.stdout
      , (resp) ->
        $scope.saveOutput = resp.data.stdout

