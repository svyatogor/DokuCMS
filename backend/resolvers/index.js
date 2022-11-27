import GraphQLJSON from 'graphql-type-json'
import GraphQLDate from 'graphql-date'

const resolvers = {
  Query: {
    ...require('./page').default.queries,
    ...require('./static_text').default.queries,
    ...require('./site').default.queries,
    ...require('./catalog').default.queries,
    ...require('./file_list').default.queries,
    ...require('./eshop').default.queries,
    ...require('./audit_log').default.queries,
  },
  Mutation: {
    ...require('./page').default.mutations,
    ...require('./static_text').default.mutations,
    ...require('./catalog').default.mutations,
    ...require('./file_list').default.mutations,
    ...require('./eshop').default.mutations,
  },
  JSON: GraphQLJSON,
  Date: GraphQLDate,
}

export default resolvers
