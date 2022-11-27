import React from 'react'
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
  IconButton,
  Dialog,
  FlatButton,
} from 'material-ui'
import {get, map} from 'lodash'
import {humanize, underscore} from 'inflection'
import {graphql, gql} from 'react-apollo'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {push} from 'react-router-redux'
import moment from 'moment'
import {t} from '../../common/utils'
import {showNotification} from '../../actions'
import Row from './dragable_row'
import itemsQuery from '../../graphql/items.gql'

class ItemsList extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}
  }

  get deleteItemConfirmationDialog() {
    const {labelField} = this.props.catalog
    const {requestDeleteItem} = this.state
    return (<Dialog
      title="Delete item?"
      actions={
        [
          <FlatButton
            label="Cancel"
            keyboardFocused
            onClick={() => this.setState({requestDeleteItem: null})}
          />,
          <FlatButton
            label="Delete"
            primary
            onClick={() => this.deleteItem()}
          />,
        ]
      }
      modal={false}
      open={!!requestDeleteItem}
      onRequestClose={() => this.setState({requestDeleteItem: null})}
    >
      {requestDeleteItem &&
        `Are you sure you want to delete ${t(this.state.requestDeleteItem.data[labelField])}`
      }
    </Dialog>)
  }

  deleteItem() {
    this.props.deleteItem({
      variables: {id: this.state.requestDeleteItem.id},
      refetchQueries: ['items'],
    }).then(() => {
      this.setState({requestDeleteItem: null})
      this.props.showNotification('Item deleted')
    })
  }

  requestDeleteItem(item) {
    this.setState({requestDeleteItem: item})
  }

  move(id, newPosition) {
    this.props.moveItem({
      variables: {id, newPosition},
      refetchQueries: ['items'],
    })
  }

  formatColumn(data, fieldDef) {
    if (!fieldDef) {
      return null
    }
    const {type} = fieldDef
    if (type === 'boolean') {
      return data ? <i className="mdi mdi-check" /> : null
    }

    if (type === 'date') {
      return data ? moment(data).format('ll') : '-'
    }

    if (type === 'datetime') {
      return data ? moment(data).format('L LT') : '-'
    }

    return t(data, this.props.locale)
  }

  editUrl(item) {
    const {catalogKey} = this.props
    if (item.folder) {
      return `/catalog/${catalogKey}/folder/${item.folder}/item/${item.id}`
    } else {
      return `/catalog/${catalogKey}/item/${item.id}`
    }
  }

  render() {
    const {visibleFields, data, push, catalog} = this.props
    const RowClass = (catalog.disableManualSorting || catalog.sortBy) ? TableRow : Row
    const rowProps = (catalog.disableManualSorting || catalog.sortBy) ?
        () => {} :
        item => ({position: item.position, onMove: (newPosition) => this.move(item.id, newPosition)})
    return (
      <Table selectable={false}>
        <TableHeader displaySelectAll={false} adjustForCheckbox={false}>
          {this.deleteItemConfirmationDialog}
          <TableRow>
            {map(visibleFields.filter(Boolean), f =>
              <TableHeaderColumn key={f}>{humanize(underscore(f))}</TableHeaderColumn>
            )}
            <TableHeaderColumn />
          </TableRow>
        </TableHeader>
        <TableBody displayRowCheckbox={false}>
          {map(data.items, item => (<RowClass key={item.id} id={item.id} {...rowProps(item)}>
            {map(visibleFields, f =>
              <TableRowColumn key={f}>
                {this.formatColumn(item.data[f], catalog.fields[f])}
              </TableRowColumn>
            )}
            <TableRowColumn style={{textAlign: 'right'}}>
              <IconButton
                onTouchTap={() => push(this.editUrl(item))}
              >
                <i className="material-icons">edit</i>
              </IconButton>
              <IconButton onTouchTap={() => this.requestDeleteItem(item)}>
                <i className="material-icons">delete</i>
              </IconButton>
            </TableRowColumn>
          </RowClass>))}
        </TableBody>
      </Table>
    );
  }
}

const deleteItem = gql`
  mutation deleteItem($id: ID!) {
    deleteItem(id: $id)
  }
`

const moveItem = gql`
  mutation moveItem($id: ID!, $newPosition: Int!) {
    moveItem(id: $id, newPosition: $newPosition)
  }
`

const mapStateToProps = (state, ownProps) => {
  return {
    locale: state.app.locale,
    visibleFields: [
      get(ownProps, 'catalog.labelField'),
      ...get(state.app.visibleFields, [ownProps.site.key, ownProps.catalogKey], []),
    ]
  }
}

const enhance = compose(
  graphql(itemsQuery, {
    options: ({folder, search, catalogKey}) => ({variables: {folder, search, catalog: catalogKey}})
  }),
  graphql(deleteItem, {name: 'deleteItem'}),
  graphql(moveItem, {name: 'moveItem'}),
  connect(mapStateToProps, {push, showNotification}),
)

export default enhance(ItemsList)
