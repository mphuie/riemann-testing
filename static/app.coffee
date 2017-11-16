app = angular.module 'myapp', ['ui.ace', 'ui.bootstrap', 'firebase']




app.controller 'MainCtrl', ($scope, $http, $firebaseArray) ->

  loopThroughMetrics = (metric, values) ->
    i = 0
    while i < values.length
      # for each iteration console.log a word
      # and make a pause after it
      do (i) ->
        setTimeout (->
          console.log values[i]
          $http.post '/send-metric', { service: metric, metric_f: values[i] }
          return
        ), 1000 * i
        return
      i++
    return

  $scope.metric = {}

  $scope.metricPath = {}

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


  $scope.lookupGraphiteMetric = ->
    console.log $scope.metricPath

    $http
      .get "http://graphite.tableausandbox.com/render/?target=#{$scope.metricPath.path}&from=-10minutes&format=json"
      .then (resp) ->
        $scope.metricPath.results = resp.data[0].datapoints
        values = _.map resp.data[0].datapoints, (i) ->
          i[0]

        console.log values

        loopThroughMetrics($scope.metricPath.path, values)

