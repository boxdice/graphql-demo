FROM node:18-bullseye

RUN apt-get update && apt-get install -y postgresql postgresql-contrib

USER postgres
RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER docker WITH SUPERUSER PASSWORD 'docker';" && \
    createdb -O docker graphql_demo

# expose port and allow access to anything
RUN sed -ri "s/^#?(listen_addresses\s*=\s*)\S+/\1'*'/" /etc/postgresql/13/main/postgresql.conf
RUN echo "host    all    all    0.0.0.0/0    md5" >> /etc/postgresql/13/main/pg_hba.conf

USER root

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5432

CMD ["./entrypoint.sh"]

