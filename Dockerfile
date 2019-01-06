FROM node:11-alpine

WORKDIR /home/nodejs/app

COPY . /home/nodejs/app

RUN ln -snf /usr/share/zoneinfo/Europe/London /etc/localtime && echo Europe/London > /etc/timezone \
	&& mkdir -p /home/nodejs/app \
	&& apk --no-cache add --virtual native-deps g++ gcc libgcc libstdc++ linux-headers make python \
  && npm install --quiet node-gyp -g \
  && npm install --quiet \
  && apk del native-deps

RUN npm install --production

CMD [ "npm", "start" ]

EXPOSE 3982