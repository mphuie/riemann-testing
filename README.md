# riemann-testing


simple GUI to help with writing/testing riemann configuration entries


## usage

build 2 docker images for

- testing riemann config
- running riemann instance to test alerting


    docker build . -t mphuie/riemann-test
    docker build . -f Dockerfile-riemann -t mphuie/riemann
 