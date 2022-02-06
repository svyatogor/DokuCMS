import React from 'react'
import DropzoneS3Uploader from 'react-dropzone-s3-uploader'
import {Dialog, FlatButton} from 'material-ui'
import {reduxForm, Field} from 'redux-form'
import {TextField} from 'redux-form-material-ui'
import {graphql, gql} from 'react-apollo'
import {connect} from 'react-redux'
import {compose} from 'recompose'
import {showNotification} from '../../actions'
import common from '../../common.scss'
import {get, isEmpty} from 'lodash'
import {getFormValues} from 'redux-form'

class NewFolder extends React.Component {
  saveFolder(data) {
    const variables = {
      folder: {
        ...data,
        locale: this.props.locale,
        id: this.props.id,
        parent: this.props.parent,
        catalog: this.props.catalog,
      },
    }
    this.props.upsert({variables, refetchQueries: ['folders']}).then(() => {
      this.props.showNotification('Folder saved')
      this.props.onFolderSaved()
    })
  }

  render() {
    const dialogActions = [
      <FlatButton label="Cancel" onTouchTap={this.props.onClose} />,
      <FlatButton
        label="Save"
        primary
        keyboardFocused
        onTouchTap={this.props.handleSubmit((data) => this.saveFolder(data))}
      />,
    ]
    const val = get(this.props.formValues, 'image')

    return (
      <Dialog
        title="New folder"
        actions={dialogActions}
        modal={false}
        open={this.props.open}
        onRequestClose={this.props.onClose}
        autoDetectWindowHeight
      >
        <form style={{maxWidth: '100%'}}>
          <Field
            name="name"
            component={TextField}
            hintText="Folder name"
            floatingLabelText="Name"
            floatingLabelFixed
            fullWidth
          />
          <div className={common.formControl}>
            <label htmlFor="">Image</label>
            <DropzoneS3Uploader
              style={{
                width: '100%',
                border: '1px dashed #ccc',
                backgroundColor: '#f8f8f8',
              }}
              onFinish={(params) => {
                this.props.change(
                  'image',
                  `https://${process.env.REACT_APP_S3_BUCKET}.s3.amazonaws.com/${params.fileKey}`
                )
              }}
              s3Url={`https://${process.env.REACT_APP_S3_BUCKET}.s3.amazonaws.com`}
              maxSize={1024 * 1024 * 5}
              upload={{
                signingUrl: '/admin/api/s3/sign',
                signingUrlWithCredentials: true,
              }}
              passChildrenProps={false}
            >
              {!isEmpty(val) && (
                <img style={{maxWidth: 200, maxHeight: 200}} src={val} alt="" />
              )}
              {isEmpty(val) && (
                <div
                  className="emptyBlock"
                  style={{fontSize: 18, lineHeight: '200px'}}
                >
                  Drop an image here
                </div>
              )}
            </DropzoneS3Uploader>
            {!isEmpty(val) && (
              <i
                className="mdi mdi-close-circle"
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 2,
                  cursor: 'pointer',
                }}
                onClick={() => this.props.change('image', '')}
              />
            )}
          </div>
        </form>
      </Dialog>
    )
  }
}

const upsertMutation = gql`
  mutation upsertFolder($folder: FolderInput!) {
    upsertFolder(folder: $folder) {
      id
    }
  }
`

const enhancer = compose(
  graphql(upsertMutation, {name: 'upsert'}),
  connect((state) => ({locale: state.app.locale, formValues:  getFormValues('newFolder')(state)}), {showNotification}),
  reduxForm({form: 'newFolder', enableReinitialize: true})
)

export default enhancer(NewFolder)
