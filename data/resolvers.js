import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import _ from "lodash";
import { PubSub } from "graphql-subscriptions";
import AWS from "aws-sdk";
import { withFilter } from "graphql-subscriptions";
import { merge } from "lodash";
import productResolver from "./resolvers/product.resolver";
import orderResolver from "./resolvers/order.resolver";
import customerResolver from "./resolvers/customer.resolver";
import vendorResolver from "./resolvers/vendor.resolver";
import orderInfoResolver from "./resolvers/orderInfo.resolver";
import pictureResolver from "./resolvers/picture.resolver";
import chatroomResolver from "./resolvers/chatroom.resolver";
import messageResolver from "./resolvers/message.resolver";
import { OrderInfo } from "./models/orderInfo.model";
require("now-env");
import mongoose from "mongoose";

export const pubsub = new PubSub();

export const PRODUCT_CREATED = "PRODUCT_CREATED";
export const CHATROOM_CREATED = "CHATROOM_CREATED";
export const MESSAGE_CREATED = "MESSAGE_CREATED";
export const ORDERINFO_CREATED = "ORDERINFO_CREATED";

const rootResolver = {
  Subscription: {
    productCreated: {
      // subscribe: withFilter(() => pubsub.asyncIterator(POST_CREATED), (payload, variables) => {
      //   return payload.createdPost.title === variables.title;
      // })
      subscribe: () => pubsub.asyncIterator(PRODUCT_CREATED)
    },
    orderInfoCreated: {
      // subscribe: withFilter(
      //   () => pubsub.asyncIterator(ORDERINFO_CREATED),
      //   (payload, variables) => {
      //     console.log("CART_PAYLOAD: ", payload);
      //     console.log("VAR: ", variables);
      //     return payload.orderedBy.toString() === variables.orderedBy.toString()
      //   }
      // )
      subscribe: () => pubsub.asyncIterator(ORDERINFO_CREATED)
    },
    chatroomCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(CHATROOM_CREATED),
        (payload, variables) => {
          console.log(payload);
          //console.log(variables)
          return payload.chatroomCreated.vendor.toString() === variables.vendor;
        }
      )
      //subscribe: () => pubsub.asyncIterator(CHATROOM_CREATED)
    },
    messageCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(MESSAGE_CREATED),
        (payload, variables) => {
          return payload.createMessage.inChatroom === variables.inChatroom;
        }
      )
    }
  },
  Query: {
    user: async (root, args, { user, User }) => {
      if (user) {
        console.log(user);
        const userInfo = await User.findOne({ _id: user.user._id });
        return userInfo;
      }

      return null;
    },
    allUsers: async (parent, args, { User }) => {
      const users = User.find();
      return users;
    }
  },
  Mutation: {
    signS3: async (parent, { filename, filetype }) => {
      const s3 = new AWS.S3({
        signatureVersion: "v4",
        region: "us-east-1",
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
      });

      const s3Params = {
        Bucket: process.env.S3_BUCKET,
        Key: filename,
        Expires: 60,
        ContentType: filetype,
        ACL: "public-read"
      };

      const signedRequest = await s3.getSignedUrl("putObject", s3Params);
      const url = `https://${
        process.env.S3_BUCKET
      }.s3.amazonaws.com/${filename}`;

      return {
        signedRequest,
        url
      };
    },
    signUp: async (parent, args, { User, Vendor }) => {
      args.password = await bcrypt.hash(args.password, 12);
      const user = await new User(args).save();

      const vendor = await new Vendor({
        user: user._id,
        name: args.email
      }).save();

      //await user.set({ vendor: vendor._id }).save();
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $set: { vendor: vendor } },
        { new: true }
      );

      updatedUser._id = updatedUser._id.toString();
      vendor._id = vendor._id.toString();

      return updatedUser;
    },
    login: async (parent, { email, password }, { User, SECRET }) => {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error("User not found!");
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new Error("Password does not match!");
      }

      const token = jwt.sign(
        {
          user: _.pick(user, ["_id", "email", "name"])
        },
        SECRET,
        {
          expiresIn: "1y"
        }
      );

      return { token };
    }
  },
  User: {
    customer: async (user, _, { Customer }) => {
      const customer = await Customer.find()
        .where("user")
        .equals(user._id)
        .exec();

      return customer[0];
    },
    vendor: async (user, _, { Vendor }) => {
      console.log("USER: ", user);

      const vendor = await Vendor.find()
        .where("user")
        .equals(user._id)
        .exec();

      return vendor[0];
    },
    message: async (user, _, { Message }) => {
      const message = await Message.find()
        .where("from")
        .equals(user._id)
        .exec();

      return message[0];
    }
  }
};

const resolvers = merge(
  rootResolver,
  productResolver,
  orderResolver,
  customerResolver,
  vendorResolver,
  orderInfoResolver,
  pictureResolver,
  chatroomResolver,
  messageResolver
);

export default resolvers;
