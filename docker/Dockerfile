FROM node:12.20.0-buster

WORKDIR /usr/local/app

RUN wget -q -O - https://packages.cloudfoundry.org/debian/cli.cloudfoundry.org.key | apt-key add - \
    && echo "deb https://packages.cloudfoundry.org/debian stable main" | tee /etc/apt/sources.list.d/cloudfoundry-cli.list \
    && apt update \
    && apt install -y python \
    && apt install -y openjdk-11-jdk \
    && apt install -y maven \
    && apt install -y cf-cli

USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm
ENV PATH=$NPM_CONFIG_PREFIX/bin:$PATH

RUN npm i -g @sap/cds-dk@3.3.1
