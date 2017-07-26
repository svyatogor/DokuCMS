import React from 'react'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {reduxForm, Field} from 'redux-form'
import {RaisedButton, MenuItem} from 'material-ui'
import {
  TextField,
  Toggle,
  SelectField,
} from 'redux-form-material-ui'
import {get, isEmpty, map} from 'lodash'
import common from '../common.scss'

const required = value => isEmpty(value) && 'Cannot be blank'

class PageEditorGeneral extends React.Component {
  onSubmit(data) {
    console.log(data)
  }

  render() {
    const {handleSubmit, pristine, submitting, layouts} = this.props
    return (
      <form onSubmit={handleSubmit(this.onSubmit.bind(this))}>
        <Field name="title" component={TextField} hintText="Page title" floatingLabelText="Title" validate={required} floatingLabelFixed
          fullWidth className={common.formControl} />
        <Field name="linkText" component={TextField} hintText="How page appears in the menus" floatingLabelText="Link text" validate={required}
          floatingLabelFixed fullWidth className={common.formControl} />
        <Field name="slug" component={TextField} hintText="Slug is used for the URL" floatingLabelText="Slug" validate={required}
          floatingLabelFixed fullWidth className={common.formControl} />
        <Field name="description" component={TextField} hintText="SEO description" floatingLabelText="Paragraph about your page"
          multiLine={true} rows={2} rowsMax={2} floatingLabelFixed fullWidth className={common.formControl} />
        <Field name="keywords" component={TextField} hintText="SEO keywords" floatingLabelText="Keywords to be added to the global ones"
          multiLine={true} rows={2} rowsMax={2} floatingLabelFixed fullWidth className={common.formControl} />
        <Field
          name="layout"
          component={SelectField}
          hintText="Page base layout"
          floatingLabelText="Layout"
          validate={required}
          className={common.formControl}
          fullWidth
        >
          {map(layouts, ({label}, key) => <MenuItem value={key} primaryText={label} key={key} />)}
        </Field>
        <Field name="published" component={Toggle} label="Published" />
        <div className={common.formActions}>
          <RaisedButton label="Save" primary={true} disabled={pristine || submitting} type="submit" />
        </div>
      </form>)
  }
}

const mapStateToProps = ({site, page}, ownProps) => {
  return {
    locale: site.locale,
    page,
    layouts: site.layouts,
    initialValues: {
      ...page,
      title: get(page, ['title', site.locale])
    }
  }
}

const enhance = compose(
  connect(mapStateToProps),
  reduxForm({form: 'page', enableReinitialize: true, keepDirtyOnReinitialize: true}),
)

export default enhance(PageEditorGeneral)
