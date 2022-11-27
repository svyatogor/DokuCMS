import React from 'react'
import {
  IconMenu,
  IconButton,
  MenuItem,
} from 'material-ui'
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert'
import {grey500} from 'material-ui/styles/colors'
import {omitBy, includes, get} from 'lodash'
import {humanize, underscore} from 'inflection'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {toggleField} from '../../actions'

class ListConfigurationMenu extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    const {
      catalog: {fields, labelField},
      catalogKey,
      site: {key: siteKey},
      visibleFields,
      toggleField,
      children,
    } = this.props
    const controllableFields = omitBy(fields, ({type}) =>
      type === 'html' || type === 'image' || type === 'password'
    )
    return (
      <IconMenu
        iconButtonElement={<IconButton><MoreVertIcon color={grey500} /></IconButton>}
        anchorOrigin={{horizontal: 'right', vertical: 'top'}}
        targetOrigin={{horizontal: 'right', vertical: 'top'}}
        style={{marginLeft: 'auto', marginTop: -5}}
      >
        {children}
        {Object.keys(controllableFields).sort().map(key => {
          const disabled = key === labelField
          const checked = includes(visibleFields, key)
          return (<MenuItem
            primaryText={humanize(underscore(key))}
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
}

const mapStateToProps = (state, ownProps) => {
  return {
    visibleFields: [
      get(ownProps, 'catalog.labelField'),
      ...get(state.app.visibleFields, [ownProps.site.key, ownProps.catalogKey], []),
    ]
  }
}

const enhance = compose(
  connect(mapStateToProps, {toggleField})
)

export default enhance(ListConfigurationMenu)