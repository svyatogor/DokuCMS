import React from 'react'
import {Route, Switch} from 'react-router-dom'
import {connect} from 'react-redux'
import {graphql} from 'react-apollo'
import List from './list'
import FlatList from './flat_list'
import ItemEditor from './item_editor'
import ItemEditorPage from './item_editor_page'
import Search from './search'
// import SiteTree from './site_tree'
// import SiteEditorWelcome from './site_editor_welcome'
// import PageEditor from './page_editor'
import siteQuery from '../../graphql/site.gql'
import {TreeWrapper} from './tree'

class Catalog extends React.Component {
  get catalog() {
    const {data: {site}, match: {params: {catalogKey}}} = this.props
    return site.documentTypes[catalogKey]
  }

  renderComponent(Component) {
    const {data: {site}, match: {params: {catalogKey}}} = this.props
    return props => (<TreeWrapper
      catalog={catalogKey}
      onAddFolder={() => this.addFolder()}
      {...props}>
      <Component catalog={this.catalog} site={site} catalogKey={catalogKey} />
    </TreeWrapper>)
  }

  render() {
    const {data: {loading}, match: {url}} = this.props
    if (loading) {
      return null
    }
    if (this.catalog) {
      if (this.catalog.hasFolders) {
        return (
          <Switch>
            <Route path={`${url}/search/:search`} render={this.renderComponent(Search)} />
            <Route path={`${url}/folder/:folder/item/new`} render={this.renderComponent(ItemEditorPage)} />
            <Route path={`${url}/folder/:folder/item/:itemId`} render={this.renderComponent(ItemEditorPage)} />
            <Route path={`${url}/item/:itemId`} render={this.renderComponent(ItemEditor)} />
            <Route path={`${url}/folder/:folder`} render={this.renderComponent(List)} />
            <Route path={`${url}`} render={this.renderComponent(Search)} />
          </Switch>
        )
      } else {
        return (
          <Switch>
            <Route path={`${url}/search/:search`} render={this.renderComponent(Search)} />
            <Route path={`${url}/item/new`} render={this.renderComponent(ItemEditorPage)} />
            <Route path={`${url}/item/:itemId`} render={this.renderComponent(ItemEditorPage)} />
            <Route path={`${url}`} render={this.renderComponent(FlatList)} />
          </Switch>
        )
      }
    }
  }
}

export default graphql(siteQuery)(connect()(Catalog))
