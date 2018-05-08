import express from 'express';
import bodyParser from 'body-parser';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import mongoose from 'mongoose';
import schema from './data/schema';
import keys from './config/keys';
import { Author } from './data/models/author.model';
import { Post } from './data/models/post.model';
import { User } from "./data/models/user.model";
import jwt from 'jsonwebtoken';
import { logInSecret } from './config/keys';
import cors from 'cors';
import { createServer } from "http";
import { execute, subscribe } from "graphql";
import { SubscriptionServer } from "subscriptions-transport-ws";

mongoose.connect(keys.mongoURI);

// Initialize the app
const app = express();

const addUser = async(req, res) => {
  const token = req.header.authorization;
  try {
    const user = await jwt.verify(token, logInSecret);
    req.user = user
  } catch(err) {
    console.log(err);
  }
  req.next();
};

app.use(cors('*'));
app.use(addUser);

// The GraphQL endpoint
app.use('/graphql', bodyParser.json(), graphqlExpress(req => ({ 
  schema,
  context: {
    Author,
    Post,
    User,
    SECRET: keys.logInSecret,
    user: req.user
  } 
})));

// GraphiQL, a visual editor for queries
app.use(
  "/graphiql",
  graphiqlExpress({
    endpointURL: "/graphql",
    subscriptionsEndpoint: "ws://localhost:3000/subscriptions"
  })
);

const server = createServer(app);

server.listen(3000, () => {
  console.log("Go to http://localhost:3000/graphiql to run queries!");
  new SubscriptionServer({
    execute,
    subscribe,
    schema,
  }, {
      server,
      path: '/subscriptions',
    });
});

// Start the server
// app.listen(3000, () => {
//   console.log('Go to http://localhost:3000/graphiql to run queries!');
// });