import React from 'react'
import {Paper} from 'material-ui'
import ItemEditor from './item_editor'
export default (params) => {
  return (
    <Paper style={{minHeight: '50%', marginLeft: '5%', paddingBottom: 20, marginTop: 15, marginBottom: 20}} className="flexContainer">
      <div style={{flex: 1, paddingLeft: 70, marginBottom: 20}}>
        <ItemEditor {...params} />
      </div>
    </Paper>)
}