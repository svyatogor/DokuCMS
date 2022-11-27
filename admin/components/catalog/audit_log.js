import {humanize, underscore} from 'inflection'
import CircularProgress from 'material-ui/CircularProgress'
import Dialog from 'material-ui/Dialog'
import {List, ListItem} from 'material-ui/List'
import moment from 'moment-timezone'
import React from 'react'
import {gql, graphql} from 'react-apollo'
import {compose} from 'recompose'

const HUMAN_ACTIONS = {
  userDailyAccess: 'User accessed platform',
}

/**
 * Dialog content can be scrollable.
 */
class AuditLog extends React.Component {
  state = {
    open: false,
  }

  render() {
    const {
      data: {loading, auditLog},
    } = this.props

    return (
      <div>
        <Dialog
          title="Audit Log"
          modal={false}
          open={true}
          onRequestClose={this.props.onRequestClose}
          autoScrollBodyContent={true}
        >
          <List>
            {loading && <CircularProgress />}
            {(auditLog || []).map((log) => {
              return (
                <ListItem
                  key={log.id}
                  // leftAvatar={<Avatar icon={<Person />} />}
                  // rightIcon={<ActionInfo />}
                  primaryText={log.user.label}
                  secondaryTextLines={2}
                  secondaryText={
                    <p>
                      <b>
                        {HUMAN_ACTIONS[log.action] ||
                          humanize(underscore(log.action))}
                      </b>
                      <br />
                      {moment(log.createdAt).format('LL')}
                    </p>
                  }
                />
              )
            })}
          </List>
        </Dialog>
      </div>
    )
  }
}

const itemGql = gql`
  query auditLog($object: ID, $user: ID) {
    auditLog(object: $object, user: $user) {
      action
      id
      user {
        id
        label
      }
      object {
        label
      }
      admin {
        name
      }
      createdAt
    }
  }
`
// const mapStateToProps = (state, ownProps) => {
//   return {
//     locale: state.app.locale,
//     visibleFields: [
//       get(ownProps, 'catalog.labelField'),
//       ...get(state.app.visibleFields, [ownProps.site.key, ownProps.catalogKey], []),
//     ]
//   }
// }

const enhance = compose(
  graphql(itemGql, {
    options: (props) => ({
      variables: {user: props.user, object: props.object},
    }),
  })
  // connect(mapStateToProps),
)

export default enhance(AuditLog)
