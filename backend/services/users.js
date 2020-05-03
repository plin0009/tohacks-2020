import { gql, ApolloServer } from "apollo-server-express";
import { User } from "../models";
import { buildFederatedSchema } from "@apollo/federation";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { secret } from "../config";

const typeDefs = gql`
  extend type Query {
    # users: [User]!
    me: User
  }
  extend type Mutation {
    signup(handle: String!, pass: String!): AuthPayload
    login(handle: String!, pass: String!): AuthPayload
    changeMe(changes: String!): User
  }
  type AuthPayload {
    token: String
  }
  extend type Bulletin @key(fields: "_id") {
    _id: ID! @external
  }
  type User @key(fields: "_id") {
    _id: ID!
    handle: String!
    pass: String!

    minAge: Int
    maxAge: Int

    homeOwner: Boolean
    autoOwner: Boolean
    student: Boolean
    veteran: Boolean
    pregnant: Boolean
    parent: Boolean
    physicalCondition: Boolean
    mentalCondition: Boolean

    employmentHours: EmploymentHours
    employmentStatus: EmploymentStatus
    income: Int
    bulletins: [Bulletin!]!
  }
  enum EmploymentHours {
    FULL_TIME
    PART_TIME
    OTHER
  }
  enum EmploymentStatus {
    EMPLOYEE
    WORKER
    SELF_EMPLOYED
    UNEMPLOYED
    OTHER
  }
`;

const resolvers = {
  Query: {
    /* users: async () => {
      return await User.find();
    }, */
    me: async (_, __, { me }) => {
      if (!me.id) {
        return null;
      }
      return await User.findById(me.id);
    },
  },
  Mutation: {
    signup: async (_, { handle, pass }) => {
      const hashedPass = await bcrypt.hash(pass, 10);
      // TODO: check if duplicate or illegal handle
      const user = new User({
        handle,
        pass: hashedPass,
        bulletins: [],
      });
      await user.save();
      const token = jwt.sign(
        {
          id: user._id,
        },
        secret
      );
      return {
        token,
      };
    },
    login: async (_, { handle, pass }) => {
      const user = await User.findOne({
        handle,
      });
      if (!user) {
        return { token: null };
      }
      const valid = await bcrypt.compare(pass, user.pass);
      if (!valid) {
        return { token: null };
      }
      const token = jwt.sign(
        {
          id: user._id,
        },
        secret
      );
      return {
        token,
      };
    },
    changeMe: async (_, { changes }, { me }) => {
      if (!me.id) {
        // no
        return null;
      }
      const user = await User.findById(me.id);
      if (!user) {
        // no
        return null;
      }
      console.log(changes);
      const updated = await user.update(JSON.parse(changes));
      // console.log(updated);
      return user;
    },
  },
  User: {
    __resolveReference: async ({ _id }) => {
      return await User.findById(_id);
    },
  },
};

export const UsersService = new ApolloServer({
  schema: buildFederatedSchema([{ typeDefs, resolvers }]),
  context: ({ req }) => {
    return {
      me: {
        id: req.header("x-user-id"),
      },
    };
  },
});
