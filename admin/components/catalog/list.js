import React from 'react'
import {
  Card,
  CardTitle,
  MenuItem,
  Dialog,
  FlatButton,
  Divider,
} from 'material-ui'
import {graphql, gql} from 'react-apollo'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import SearchBar from 'material-ui-search-bar'
import {push} from 'react-router-redux'
import {get} from 'lodash'
import {t} from '../../common/utils'
import {showNotification} from '../../actions'
import ItemsList from './items_list'
import ListConfigurationMenu from './list_configuration_menu'
import FolderEditDialog from './folder_editor'

class List extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}
  }

  get deleteFolderConfirmationDialog() {
    const {requestDeleteFolder} = this.state
    return (<Dialog
      title="Delete item?"
      actions={
        [
          <FlatButton
            label="Cancel"
            keyboardFocused
            onClick={() => this.setState({requestDeleteFolder: null})}
          />,
          <FlatButton
            label="Delete"
            primary
            onClick={() => this.deleteFolder()}
          />,
        ]
      }
      modal={false}
      open={!!requestDeleteFolder}
      onRequestClose={() => this.setState({requestDeleteFolder: null})}
    >
      Are you sure you want to delete this folder with all subfolders and items?
    </Dialog>)
  }

  deleteFolder() {
    const {showNotification, push, deleteFolder, folderData, catalogKey} = this.props
    console.log(folderData);
    deleteFolder({
      variables: {id: folderData.folder.id},
      refetchQueries: ['folders'],
    }).then(() => {
      this.setState({requestDeleteFolder: null})
      showNotification('Folder deleted')
      push(`/catalog/${catalogKey}`)
    })
  }

  requestDeleteFolder() {
    this.setState({requestDeleteFolder: true})
  }

  showEditFolder() {
    this.setState({showEditFolder: true})
  }

  render() {
    const {catalogKey, catalog, site, folderData, match: {params: {folder}}} = this.props
    const {search} = this.state
    if (folderData.loading) {
      return null
    }
    return (
      <div>
      <SearchBar
        onChange={search => this.setState({search})}
        onRequestSearch={() => {}}
        style={{marginBottom: 10, marginTop: 15, marginLeft: '5%'}}
        value={this.state.search}
      />
      {search && search.length >= 3 && <Card style={{minHeight: '50%', marginLeft: '5%', paddingBottom: 20, marginTop: 15, marginBottom: 20}} className="flexContainer">
        <CardTitle title={search} />
        <ItemsList search={search} site={site} catalog={catalog} catalogKey={catalogKey} />
      </Card>}

      {!search &&
        <Card style={{minHeight: '50%', marginLeft: '5%', paddingBottom: 20, marginTop: 15, marginBottom: 20}} className="flexContainer">
          {this.deleteFolderConfirmationDialog}
          <CardTitle title={t(get(folderData, 'folder.name'))} style={{display: 'flex'}}>
            <ListConfigurationMenu {...this.props}>
              <MenuItem
                primaryText="Edit folder"
                onTouchTap={() => this.showEditFolder()}
                leftIcon={<i className="material-icons">edit</i>}
              />
              <MenuItem
                primaryText="Delete folder"
                style={{color: 'red'}}
                onTouchTap={() => this.requestDeleteFolder()}
                leftIcon={<i className="material-icons">delete</i>}
              />
              <Divider />
            </ListConfigurationMenu>
          </CardTitle>
          <ItemsList folder={folder} site={site} catalog={catalog} catalogKey={catalogKey} />}

          <FolderEditDialog
            visible={this.state.showEditFolder}
            folder={folderData.folder}
            onClose={() => this.setState({showEditFolder: false})}
          />
        </Card>
      }
      </div>
    );
  }

  componentWillReceiveProps(props, state) {
    this.setState({search: ''})
  }
}

const folder = gql`
  query folder($id: ID!) {
    folder(id: $id) { id name hidden image }
  }
`

const deleteFolder = gql`
  mutation deleteFolder($id: ID!) {
    deleteFolder(id: $id)
  }
`

const enhance = compose(
  graphql(folder, {
    options: ({match}) => ({ variables: { id: match.params.folder } }),
    name: 'folderData'
  }),
  graphql(deleteFolder, {name: 'deleteFolder'}),
  connect(() => ({}), {push, showNotification})
)

export default enhance(List)