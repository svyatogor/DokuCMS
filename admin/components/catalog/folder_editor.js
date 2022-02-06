import {isEmpty, get} from 'lodash'
import {Dialog, FlatButton} from 'material-ui'
import React from 'react'
import {gql, graphql} from 'react-apollo'
import DropzoneS3Uploader from 'react-dropzone-s3-uploader'
import {connect} from 'react-redux'
import {compose} from 'recompose'
import {Field, reduxForm, getFormValues} from 'redux-form'
import {Checkbox, TextField} from 'redux-form-material-ui'
import {showNotification} from '../../actions'
import common from '../../common.scss'
import {t} from '../../common/utils'

class FolderForm extends React.Component {
  onSaveFolder(data) {
    const {locale, showNotification, mutate, onClose} = this.props
    const {name, hidden, id, image} = data
    const folder = {name, hidden, id, locale, image}
    mutate({variables: {folder}}).then(() => {
      showNotification('Folder updated')
      onClose()
    })
  }

  render() {
    const {folder} = this.props
    if (!folder) {
      return null
    }
    const dialogActions = [
      <FlatButton
        label="Save"
        primary={true}
        keyboardFocused={true}
        onTouchTap={this.props.handleSubmit((data) => this.onSaveFolder(data))}
      />,
    ]
    const val = get(this.props.formValues, 'image')

    return (
      <Dialog
        title={t(folder.name)}
        actions={dialogActions}
        modal={false}
        open={this.props.visible || false}
        onRequestClose={this.props.onClose}
        autoDetectWindowHeight
      >
        <form style={{maxWidth: '100%'}}>
          <Field
            name="name"
            component={TextField}
            fullWidth
            floatingLabelText="Name"
            style={{marginBottom: 10}}
          />
          <Field
            name="hidden"
            component={Checkbox}
            label="Hidden"
            labelPosition="left"
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
      name
      hidden
      image
    }
  }
`

const mapStateToProps = ({app: {locale}, ...state}, {folder}) => {
  const initialValues = {
    ...folder,
    name: t(folder.name, locale),
  }
  return {
    initialValues,
    formValues: {...initialValues, ...getFormValues('folder')(state)},
    locale,
  }
}

const e = compose(
  connect(mapStateToProps, {showNotification}),
  graphql(upsertMutation),
  reduxForm({form: 'folder', enableReinitialize: true})
)

export default e(FolderForm)
