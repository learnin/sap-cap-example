FROM node:14.15.1-alpine3.11

WORKDIR /usr/local/app

RUN apk update \
    && apk add python \
    && apk add openjdk11 \
    && apk add maven

USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm
ENV PATH=$NPM_CONFIG_PREFIX/bin:$PATH

RUN npm i -g @sap/cds-dk
