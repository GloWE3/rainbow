import lang from 'i18n-js';
import PropTypes from 'prop-types';
import React from 'react';
import { deviceUtils } from '../../utils';
import { FlyInAnimation } from '../animations';
import { View, Text } from 'react-primitives';
import { RecyclerListView, LayoutProvider, DataProvider } from "recyclerlistview";
import styled from 'styled-components/primitives/dist/styled-components-primitives.esm';
import { colors } from '../../styles';
import { abbreviations } from '../../utils';
import { TruncatedAddress } from '../text';
import { ButtonPressAnimation } from '../animations';
import { Icon } from '../icons';
import { Centered, Column, Row } from '../layout';
import { sheetVerticalOffset } from '../../navigation/transitions/effects';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
import { Animated, LayoutAnimation } from 'react-native';
import {
  getLocalContacts,
  deleteLocalContact,
} from '../../handlers/commonStorage';
import { withNavigation } from 'react-navigation';
import { compose } from 'recompact';
import { Alert } from '../alerts';
import { showActionSheetWithOptions } from '../../utils/actionsheet';

const rowHeight = 62;

const AvatarWrapper = styled(View)`
  flex-direction: row;
  margin: 11px 15px;
`;

const AvatarCircle = styled(View)`
  height: 40px;
  width: 40px;
  border-radius: 20px;
`;

const FirstLetter = styled(Text)`
  width: 100%;
  text-align: center;
  line-height: 40px;
  font-size: 18px;
  color: #fff;
  font-weight: 600;
`;

const ContactColumn = styled(View)`
  height: 40px;
  flex-direction: column;
  justify-content: space-between;
  margin-left: 11px;
`;

const TopRow = styled(Text)`
  font-weight: 500,
  font-size: 16
`;

const BottomRow = styled(TruncatedAddress).attrs({
  align: 'left',
  firstSectionLength: abbreviations.defaultNumCharsPerSection,
  size: 'smedium',
  truncationLength: 4,
  weight: 'regular',
  color: colors.blueGreyDark,
})`
  opacity: 0.4;
  width: 100%;
`;

const NOOP = () => undefined;

const layoutItemAnimator = {
  animateDidMount: NOOP,
  animateShift: NOOP,
  animateWillMount: NOOP,
  animateWillUnmount: NOOP,
  animateWillUpdate:  () => LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity')),
};

let position = 0;

class Avatar extends React.PureComponent {

  onPress = () => {
    this.props.onPress(this.props.address);
  }

  renderRightAction = (text, color, x, progress, onPress) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [x, 0],
    });

    return (
      <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
        <RectButton
          style={[{
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            backgroundColor: color 
          }]}
          onPress={onPress}>
          <Text style={{
            color: 'white', 
            fontSize: 16,
            backgroundColor: 'transparent',
            padding: 10,
          }}>
            {text}
          </Text>
        </RectButton>
      </Animated.View>
    );
  };

  deleteHandler = async () => {
    this.close();
    showActionSheetWithOptions({
      cancelButtonIndex: 1,
      destructiveButtonIndex: 0,
      options: [`Delete ${this.props.nickname}`, 'Cancel'],
    }, async (buttonIndex) => {
      if (buttonIndex === 0) {
        await deleteLocalContact(this.props.address);
        // Alert({title: `Success`, message: `Contact has been deleted from your address book`})
        this.props.onChange();
      }
    });
  };

  editHandler = async () => {
    console.log(this.props);
    this.close();
    this.props.navigation.navigate('ExpandedAssetScreen', {
      address: this.props.address,
      color: this.props.color,
      asset: [],
      contact: {
        address: this.props.address,
        color: this.props.color,
        nickname: this.props.nickname,
      },
      type: 'contact',
      onCloseModal: this.props.onChange,
    });
  };

  renderRightActions = progress => (
    <View style={{ width: 140, flexDirection: 'row' }}>
      {this.renderRightAction('Edit', '#ffab00', 140, progress, this.editHandler)}
      {this.renderRightAction('Delete', '#dd2c00', 70, progress, this.deleteHandler)}
    </View>
  );

  updateRef = ref => {
    this._swipeableRow = ref;
  };
  close = () => {
    this._swipeableRow.close();
  };

  render() {
    const item = this.props;
    return (
      <Swipeable
        ref={this.updateRef}
        friction={2}
        rightThreshold={40}
        renderRightActions={this.renderRightActions}>
        <ButtonPressAnimation onPress={this.onPress} scaleTo={0.96}>
          <AvatarWrapper>
            <AvatarCircle style={{ backgroundColor: colors.avatarColor[item.color] }} >
              <FirstLetter>
                {item.nickname.charCodeAt(0) < 55000? 
                item.nickname[0] : 
                item.nickname.length > 1 && item.nickname.charCodeAt(0) > 55000 && item.nickname[0] + "" + item.nickname[1]}
              </FirstLetter>
            </AvatarCircle>
            <ContactColumn>
              <TopRow>
                {item.nickname}
              </TopRow>
              <BottomRow address={item.address} />
            </ContactColumn>
          </AvatarWrapper>
        </ButtonPressAnimation>
      </Swipeable>
    )
  }
}

class SendContactList extends React.Component {
  balancesRenderItem = item => (
    <Avatar 
      onChange={this.props.onUpdateContacts} 
      onPress={this.props.onPressContact} 
      navigation={this.props.navigation}
      {...item} 
    />
  );

  constructor(args) {
    super(args);
    
    this.state = {
      contacts: [],
    }

    this._layoutProvider = new LayoutProvider((i) => {
      return 'COIN_ROW';
    }, (type, dim) => {
      if (type == "COIN_ROW") {
        dim.width = deviceUtils.dimensions.width;
        dim.height = rowHeight;
      } else {
        dim.width = 0;
        dim.height = 0;
      }
    });
    this._renderRow = this._renderRow.bind(this);
  }

  _renderRow(type, data) {
    if (type == "COIN_ROW") {
      return this.balancesRenderItem(data);
    } else {
      return this.balancesRenderItem(data);
    }
  }

  componentWillReceiveProps = (props) => {
    let newAssets = Object.assign([], props.allAssets);
    newAssets.reverse();
    if(newAssets !== this.state.contacts) {
      this.setState({ contacts: newAssets });
    }
  }

  shouldComponentUpdate = () => {
    if(position < 0) {
      return false;
    }
    return true;
  }

  render() {
    return (
      <FlyInAnimation style={{ flex: 1, width: '100%', paddingBottom: 20 }}>
        {this.state.contacts.length == 0 ?
          <Column
            css={`
              background-color: ${colors.white};
              padding-bottom: ${sheetVerticalOffset + 19};
            `}
            flex={1}
            justify="space-between"
          >
            <Centered flex={1} opacity={0.06}>
              <Icon
                color={colors.blueGreyDark}
                name="send"
                style={{ height: 88, width: 91 }}
              />
            </Centered>
          </Column>
          :
          <RecyclerListView
            rowRenderer={this._renderRow}
            dataProvider={
              new DataProvider((r1, r2) => {
                return r1 !== r2;
              }).cloneWithRows(this.state.contacts)
            }
            layoutProvider={this._layoutProvider}
            // itemAnimator={layoutItemAnimator}
            onScroll={(event, _offsetX, offsetY) => {
              position = offsetY;
            }}
            optimizeForInsertDeleteAnimations
          />
        }
      </FlyInAnimation>
    );
  };
}

export default compose(withNavigation)(SendContactList);
