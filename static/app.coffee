app = angular.module 'myapp', ['ui.ace', 'ui.bootstrap', 'firebase', 'toaster']




app.controller 'MainCtrl', ($scope, $http, $firebaseArray, toaster) ->

  $scope.metricStatus = ''

  loopThroughMetrics = (metric, values) ->
    i = 0
    while i < values.length
      do (i) ->
        setTimeout (->
          console.log values[i]
          $scope.metricStatus = $scope.metricStatus + '.'
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

    if $scope.metric.metric_f.indexOf(',') > -1
      console.log 'comma delim!!!???'
      values = _.map $scope.metric.metric_f.split(','), (i) ->
        parseInt(i)
      $scope.metricStatus = ''
      loopThroughMetrics $scope.metric.service, values
    else
      $http
        .post '/send-metric', $scope.metric
        .then ->
          console.log 'send!'
        , ->
          toaster.pop 'error', 'riemann', 'error in metric!'

  $scope.clearAlerts = ->
    $http.delete 'https://riemann-tester.firebaseio.com/alerts.json'

  $scope.startRiemann = ->
    toaster.pop 'success', 'riemann', 'starting/restarting riemann...'
    $http.get '/start-riemann'

  $scope.save = ->

    toaster.pop 'success', 'riemann', 'testing riemann config...'

    $scope.saveOutput = ''

    $http
      .post '/generate-config', { config: $scope.config }
      .then (resp) ->
        $scope.saveOutput = resp.data.stdout
        $http.get '/start-riemann'
          .then ->
            toaster.pop 'success', 'riemann', 'good, restarting riemann!...'
      , (resp) ->
        $scope.saveOutput = resp.data.stdout
        toaster.pop 'error', 'riemann', 'config does not validate!'


  $scope.lookupGraphiteMetric = ->
    console.log $scope.metricPath

    $http
      .get "http://graphite.tableausandbox.com/render/?target=#{$scope.metricPath.path}&from=-10minutes&format=json"
      .then (resp) ->
        $scope.metricPath.results = resp.data[0].datapoints
        values = _.map resp.data[0].datapoints, (i) ->
          i[0]

        $scope.metricStatus = ''
        loopThroughMetrics($scope.metricPath.path, values)

