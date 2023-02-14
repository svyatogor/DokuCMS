import React from 'react'
import {graphql, gql} from 'react-apollo'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {RaisedButton} from 'material-ui'
import {t} from '../../common/utils'
import Redactor from '../redactor'
import common from '../../common.scss'
import {showNotification} from '../../actions'

class StaticText extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    if (this.props.data.loading) {
      return null
    }
    const {locale} = this.props
    const value = this.state.value || t(this.props.data.staticText.content, locale)
    const parent = {type: 'StaticText', id: this.props.id}
    return (<div>
      <Redactor value={value || ''} onChange={(value) => this.setState({value})} parent={parent} />
      <div className={common.formActions}>
        <RaisedButton label="Save" primary={true} disabled={!this.state.value} type="submit" onTouchTap={() => this.save()} />
      </div>
    </div>)
  }

  componentWillUpdate({locale}) {
    if (locale !== this.props.locale) {
      this.setState({value: null})
    }
  }

  save() {
    const input = {
      id: this.props.id,
      locale: this.props.locale,
      content: this.state.value,
    }
    this.props.mutate({variables: {input}, refetchQueries: ['staticText']}).then(() =>
      this.props.showNotification("Text saved")
    )
  }
}

const getStaticText = gql`
  query staticText($id: ID!) {
    staticText(id: $id) { content }
  }
`

const saveStaticText = gql`
  mutation saveStaticText($input: StaticTextInput!) {
    saveStaticText(input: $input) { content }
  }
`

const mapStateToProps = ({app: {locale}}) => ({
  locale
})

const enhance = compose(
  connect(mapStateToProps, {showNotification}),
  graphql(getStaticText),
  graphql(saveStaticText),
)
export default enhance(StaticText)
