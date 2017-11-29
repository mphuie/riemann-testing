app = angular.module 'myapp', ['ui.router', 'ui.ace', 'ui.bootstrap', 'firebase', 'toaster']


app.config ['$stateProvider', '$urlRouterProvider', ($stateProvider, $urlRouterProvider) ->
  $urlRouterProvider.otherwise '/'
  $stateProvider
    .state 'home', {
      url: '/'
      templateUrl: '/static/partials/editor.html'
      controller: 'MainCtrl'
    }
    .state 'configs', {
      url: '/configs'
      templateUrl: '/static/partials/configs.html'
      controller: 'ConfigCtrl'
    }
]

app.controller 'ConfigCtrl', ($scope, $http, toaster) ->
  console.log 'test'

  $http
    .get '/config-entry'
    .then (resp) ->
      $scope.configs = resp.data

  $scope.buildFullConfig = ->
    $http
      .post '/generate-full-config', {}
      .then ->
        toaster.pop 'success', 'status', 'success!'

  $scope.deleteConfig = (id) ->
    $http
      .delete '/config-entry/' + id
      .then ->
        toaster.pop 'success', 'status', 'deleted!'




app.controller 'MainCtrl', ($scope, $http, $firebaseArray, toaster) ->
  
  $scope.metric = {}

  $scope.riemannHosts = [
    'localhost',
    'riemann.hmp.tableausandbox.com',
    'riemann.hmp.tableauprod.net'
  ]
  $scope.metricStatus = ''

  loopThroughMetrics = (metric, values) ->
    i = 0
    while i < values.length
      do (i) ->
        setTimeout (->
          console.log metric
          console.log values[i]
          $scope.metricStatus = $scope.metricStatus + '.'
          $http.post '/send-metric', { service: metric.service, metric_f: values[i], state: metric.state, tags: metric.tags, riemannHost: metric.riemannHost }
          return
        ), 1000 * i
        return
      i++
    return

  $scope.metric = {}
  $scope.metricPath = { path: 'qa01_online_10ay.cluster_health.cpu.usage.0001f-chsx01-tableausandbox-com' }

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

    $scope.metric.riemannHost = $scope.riemannHosts[$scope.metric.riemannHost]

    console.log $scope.metric

    if $scope.metric.metric_f.indexOf(',') > -1
      values = _.map $scope.metric.metric_f.split(','), (i) ->
        parseInt(i)
      $scope.metricStatus = ''
      loopThroughMetrics $scope.metric, values
    else
      $http
        .post '/send-metric', $scope.metric
        .then ->
          toaster.pop 'success', 'riemann', 'metric sent!'
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
      .post '/generate-test-config', { config: $scope.config }
      .then (resp) ->
        $scope.saveOutput = resp.data.stdout
        $http.get '/start-riemann'
          .then ->
            toaster.pop 'success', 'riemann', 'good, restarting riemann!...'
      , (resp) ->
        $scope.saveOutput = resp.data.stdout
        toaster.pop 'error', 'riemann', 'config does not validate!'


  $scope.lookupGraphiteMetric = ->

    $http
      .get "http://graphite.tableausandbox.com/render/?target=#{$scope.metricPath.path}&from=-10minutes&format=json"
      .then (resp) ->
        $scope.metricPath.results = resp.data[0].datapoints
        values = _.map resp.data[0].datapoints, (i) ->
          i[0]

        $scope.metricStatus = ''
        loopThroughMetrics($scope.metricPath.path, values)


  $scope.saveConfig = ->
    payload = {
      entry: $scope.config
      contact: $scope.newConfig.contact
      description: $scope.newConfig.description
    }

    $http
      .post '/save-config-entry', payload
      .then (resp) ->
        console.log payload