import React from 'react'
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
  Card,
  CardTitle,
  IconMenu,
  IconButton,
  MenuItem,
} from 'material-ui'
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert'
import {grey500} from 'material-ui/styles/colors'
import {omitBy, includes, get, map} from 'lodash'
import {humanize} from 'inflection'
import {graphql, gql} from 'react-apollo'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {push} from 'react-router-redux'
import {t} from '../../common/utils'
import {toggleField} from '../../actions'

class List extends React.Component {
  get configurationMenu() {
    const {
      catalog: {fields, labelField},
      catalogKey,
      site: {key: siteKey},
      visibleFields, toggleField
    } = this.props
    const controllableFields = omitBy(fields, ({type}) =>
      type === 'html' || type === 'image'
    )
    return (
      <IconMenu
        iconButtonElement={<IconButton><MoreVertIcon color={grey500} /></IconButton>}
        anchorOrigin={{horizontal: 'right', vertical: 'top'}}
        targetOrigin={{horizontal: 'right', vertical: 'top'}}
        style={{marginLeft: 'auto', marginTop: -5}}
      >
        {Object.keys(controllableFields).sort().map(key => {
          const disabled = key === labelField
          const checked = includes(visibleFields, key)
          return (<MenuItem
            primaryText={humanize(key)}
            key={key}
            style={{paddingLeft: disabled ? 70 : (checked ? -5 : 55)}}
            onTouchTap={() => toggleField(siteKey, catalogKey, key)}
            disabled={disabled}
            checked={checked}
          />)
        })}

      </IconMenu>
    )
  }

  render() {
    const {visibleFields, data, folderData, catalogKey, match: {params: {folder}}} = this.props
    return (
      <Card style={{minHeight: '50%', marginLeft: '5%', paddingBottom: 20, marginTop: 15, marginBottom: 20}} className="flexContainer">
        <CardTitle title={t(get(folderData, 'folder.name'))} style={{display: 'flex'}}>
          {this.configurationMenu}
        </CardTitle>
        <Table selectable={false}>
          <TableHeader displaySelectAll={false} adjustForCheckbox={false}>
            <TableRow>
              {visibleFields.map(f =>
                <TableHeaderColumn key={f}>{humanize(f)}</TableHeaderColumn>
              )}
              <TableHeaderColumn />
            </TableRow>
          </TableHeader>
          <TableBody displayRowCheckbox={false}>
            {map(data.items, item => (<TableRow key={item.id} hoverable>
              {map(visibleFields, f => <TableRowColumn key={f}>{t(item.data[f])}</TableRowColumn>)}
              <TableRowColumn style={{textAlign: 'right'}}>
                <IconButton
                  href={`/admin/catalog/${catalogKey}/folder/${folder}/product/${item.id}`}
                >
                  <i className="material-icons">edit</i>
                </IconButton>
              </TableRowColumn>
            </TableRow>))}
          </TableBody>
        </Table>
      </Card>
    );
  }
}

const items = gql`
  query items($folder: ID!) {
    items(folder: $folder) {
      id
      data
    }
  }
`
const folder = gql`
  query items($id: ID!) {
    folder(id: $id) { name }
  }
`

const mapStateToProps = (state, ownProps) => {
  return {
    visibleFields: [
      get(ownProps, 'catalog.labelField'),
      ...get(state.app.visibleFields, [ownProps.site.key, ownProps.catalogKey], []),
    ]
  }
}

const enhance = compose(
  graphql(folder, {
    options: ({match}) => ({ variables: { id: match.params.folder } }),
    name: 'folderData'
  }),
  graphql(items, {
    options: ({match}) => ({ variables: { folder: match.params.folder } }),
  }),
  connect(mapStateToProps, {toggleField, push})
)

export default enhance(List)