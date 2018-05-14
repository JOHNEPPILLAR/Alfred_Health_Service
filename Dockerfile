FROM node:latest

RUN ln -snf /usr/share/zoneinfo/Europe/London /etc/localtime && echo Europe/London > /etc/timezone \
	&& apt-get -y update \
	&& apt-get -y upgrade \
	&& npm install pm2 -g \
	&& mkdir -p /home/nodejs/app 

WORKDIR /home/nodejs/app

COPY package.json /home/nodejs/app

RUN npm install --production

COPY . /home/nodejs/app

CMD [ "pm2-runtime", "start", "/home/nodejs/app/pm2.json" ]

EXPOSE 3984