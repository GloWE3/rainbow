import { useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager } from 'react-native';
import { ContextMenuButton } from 'react-native-ios-context-menu';
import ChainLogo from '../components/ChainLogo';
import Divider from '../components/Divider';
import Spinner from '../components/Spinner';
import ButtonPressAnimation from '../components/animations/ButtonPressAnimation';
import { RequestVendorLogoIcon } from '../components/coin-icon';
import { ContactAvatar } from '../components/contacts';
import ImageAvatar from '../components/contacts/ImageAvatar';
import { Centered, Column, Flex, Row } from '../components/layout';
import { Sheet, SheetActionButton, SheetActionButtonRow } from '../components/sheet';
import { analytics } from '@/analytics';
import { getAccountProfileInfo } from '@/helpers/accountInfo';
import { getDappHostname } from '@/helpers/dappNameHandler';
import WalletConnectApprovalSheetType from '@/helpers/walletConnectApprovalSheetTypes';
import { androidShowNetworksActionSheet, NETWORK_MENU_ACTION_KEY_FILTER, networksMenuItems } from '@/helpers/walletConnectNetworks';
import { useAccountSettings, useWallets } from '@/hooks';
import { Navigation, useNavigation } from '@/navigation';
import Routes from '@/navigation/routesNames';
import styled from '@/styled-thing';
import { Box, Columns, Column as RDSColumn, Inline, Text } from '@/design-system';
import ChainBadge from '@/components/coin-icon/ChainBadge';
import * as lang from '@/languages';
import { useDappMetadata } from '@/resources/metadata/dapp';
import { DAppStatus } from '@/graphql/__generated__/metadata';
import { InfoAlert } from '@/components/info-alert/info-alert';
import { EthCoinIcon } from '@/components/coin-icon/EthCoinIcon';
import { findWalletWithAccount } from '@/helpers/findWalletWithAccount';
import { ChainId } from '@/chains/types';
import { chainsLabel, chainsNativeAsset, defaultChains, supportedWalletConnectChainIds } from '@/chains';
import { isL2Chain } from '@/handlers/web3';

const LoadingSpinner = styled(android ? Spinner : ActivityIndicator).attrs(({ theme: { colors } }) => ({
  color: colors.alpha(colors.blueGreyDark, 0.3),
  size: android ? 40 : 'large',
}))({});

const DappLogo = styled(RequestVendorLogoIcon).attrs(({ theme: { colors } }) => ({
  backgroundColor: colors.transparent,
  borderRadius: 18,
  showLargeShadow: true,
  size: 60,
}))({
  marginBottom: 24,
});

const LabelText = ({ children, ...props }) => {
  return (
    <Text color="primary (Deprecated)" numberOfLines={1} size="18px / 27px (Deprecated)" weight="bold" {...props}>
      {children}
    </Text>
  );
};

const SwitchText = ({ children, ...props }) => {
  return (
    <Text color="secondary40 (Deprecated)" size="14px / 19px (Deprecated)" weight="semibold" {...props}>
      {children}
    </Text>
  );
};

const NetworkPill = ({ chainIds }) => {
  const { colors } = useTheme();

  const availableNetworkChainIds = useMemo(() => chainIds.sort(chainId => (chainId === ChainId.mainnet ? -1 : 1)), [chainIds]);

  const walletConnectSupportedChains = supportedWalletConnectChainIds.map(chainId => defaultChains[chainId]);

  const networkMenuItems = useMemo(() => {
    walletConnectSupportedChains
      .filter(({ id }) => chainIds.includes(id))
      .map(chain => ({
        actionKey: chain.id,
        actionTitle: chainsLabel[chain.id],
        icon: {
          iconType: 'ASSET',
          iconValue: `${isL2Chain({ chainId: chain.id }) ? `${chain.name}BadgeNoShadow` : 'ethereumBadge'}`,
        },
      }));
  }, [chainIds, walletConnectSupportedChains]);

  if (availableNetworkChainIds.length === 0) return null;

  return (
    <ContextMenuButton
      // @ts-expect-error overloaded props ContextMenuButton
      menuConfig={{ menuItems: networkMenuItems, menuTitle: '' }}
      isMenuPrimaryAction
      onPressMenuItem={() => {}}
      useActionSheetFallback={false}
      width="100%"
    >
      <Box
        as={ButtonPressAnimation}
        // @ts-expect-error overloaded props ButtonPressAnimation
        scaleTo={0.96}
        onPress={() => {}}
        testID={'available-networks-v2'}
        paddingTop="8px"
        marginRight={{ custom: -2 }}
      >
        <Box flexDirection="row" justifyContent="flex-end" alignItems="center" width="100%">
          {availableNetworkChainIds.length > 1 ? (
            <>
              {availableNetworkChainIds.map((chainId, index) => {
                return (
                  <Box
                    key={`availableNetwork-${chainId}`}
                    marginTop={{ custom: -2 }}
                    marginLeft={{ custom: index > 0 ? -6 : 0 }}
                    style={{
                      position: 'relative',
                      backgroundColor: colors.transparent,
                      zIndex: availableNetworkChainIds.length - index,
                      borderRadius: 30,
                      borderWidth: 2,
                      borderColor: colors.white,
                    }}
                  >
                    {chainId !== ChainId.mainnet ? (
                      <ChainBadge chainId={chainId} position="relative" size="small" />
                    ) : (
                      <EthCoinIcon size={20} />
                    )}
                  </Box>
                );
              })}
            </>
          ) : (
            <Inline alignVertical="center" wrap={false}>
              {availableNetworkChainIds[0] !== ChainId.mainnet ? (
                <ChainBadge chainId={availableNetworkChainIds[0]} position="relative" size="small" />
              ) : (
                <EthCoinIcon size={20} />
              )}

              <Box paddingLeft="6px">
                <Text color="primary (Deprecated)" numberOfLines={1} size="18px / 27px (Deprecated)" weight="bold">
                  {chainsLabel[availableNetworkChainIds[0]]}
                </Text>
              </Box>
            </Inline>
          )}
        </Box>
      </Box>
    </ContextMenuButton>
  );
};

export default function WalletConnectApprovalSheet() {
  const { colors, isDarkMode } = useTheme();
  const { goBack } = useNavigation();
  const { params } = useRoute();
  const { chainId: settingsChainId, accountAddress } = useAccountSettings();
  const { navigate } = useNavigation();
  const { selectedWallet, walletNames, wallets } = useWallets();
  const handled = useRef(false);
  const initialApprovalAccount = useMemo(
    () =>
      params?.meta?.proposedAddress
        ? { address: params.meta.proposedAddress, wallet: findWalletWithAccount(wallets, params.meta.proposedAddress) }
        : {
            address: accountAddress,
            wallet: selectedWallet,
          },
    [accountAddress, params?.meta?.proposedAddress, selectedWallet, wallets]
  );
  const [approvalAccount, setApprovalAccount] = useState(initialApprovalAccount);

  const type = params?.type || WalletConnectApprovalSheetType.connect;
  const source = params?.source;

  /**
   * CAN BE UNDEFINED if we navigated here with no data. This is how we show a
   * loading state.
   */
  const meta = params?.meta || {};
  const timeout = params?.timeout;
  const callback = params?.callback;
  const receivedTimestamp = params?.receivedTimestamp;
  const timedOut = params?.timedOut;
  const failureExplainSheetVariant = params?.failureExplainSheetVariant;
  const chainIds = meta?.chainIds; // WC v2 supports multi-chain
  const chainId = meta?.proposedChainId || chainIds?.[0] || 1; // WC v1 only supports 1
  const currentChainId = params?.currentChainId;
  const [approvalChainId, setApprovalChainId] = useState(currentChainId || settingsChainId);
  const isWalletConnectV2 = meta.isWalletConnectV2;

  const { dappName, dappUrl, dappScheme, imageUrl, peerId } = meta;

  const verifiedData = params?.verifiedData;
  const { data: metadata } = useDappMetadata({
    url: verifiedData?.origin || dappUrl,
  });

  const isScam = metadata?.status === DAppStatus.Scam;

  // we can only safely mark a dapp as verified if the source is the browser
  const isVerified = metadata?.status === DAppStatus.Verified && source === 'browser';

  const accentColor = isScam ? colors.red : colors.appleBlue;

  useEffect(() => {
    return () => {
      clearTimeout(timeout);
    };
  }, [timeout]);

  const formattedDappUrl = useMemo(() => {
    return getDappHostname(dappUrl);
  }, [dappUrl]);

  const approvalAccountInfo = useMemo(() => {
    const approvalAccountInfo = getAccountProfileInfo(approvalAccount.wallet, walletNames, approvalAccount.address);
    return {
      ...approvalAccountInfo,
      accountLabel: approvalAccountInfo.accountENS || approvalAccountInfo.accountName || approvalAccount.address,
    };
  }, [walletNames, approvalAccount.wallet, approvalAccount.address]);

  /**
   * In WC v1 this was the network the dapp was requesting, which was editable
   * by the end-user on this approval screen. In v2, the dapp choses one or
   * more networks and the user can't change. So this data isn't applicable in
   * v2.
   */
  const approvalNetworkInfo = useMemo(() => {
    const chain = defaultChains[approvalChainId || ChainId.mainnet];
    const nativeAsset = chainsNativeAsset[chain.id];
    return {
      chainId: chain.id,
      color: isDarkMode ? nativeAsset.colors.primary : nativeAsset.colors.fallback || nativeAsset.colors.primary,
      name: chain.name,
    };
  }, [approvalChainId, isDarkMode]);

  const handleOnPressNetworksMenuItem = useCallback(
    ({ nativeEvent }) => setApprovalChainId(nativeEvent.actionKey?.replace(NETWORK_MENU_ACTION_KEY_FILTER, '')),
    [setApprovalChainId]
  );

  const handleSuccess = useCallback(
    (success = false) => {
      if (callback) {
        setTimeout(
          () => callback(success, approvalNetworkInfo.chainId, approvalAccount.address, peerId, dappScheme, dappName, dappUrl),
          300
        );
      }
    },
    [approvalAccount.address, callback, approvalNetworkInfo, peerId, dappScheme, dappName, dappUrl]
  );

  useEffect(() => {
    if (chainId && type === WalletConnectApprovalSheetType.connect) {
      setApprovalChainId(chainId);
    }
  }, [chainId, type]);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      analytics.track('Shown Walletconnect session request');
    });
    // Reject if the modal is dismissed
    return () => {
      if (!handled.current) {
        handleSuccess(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(() => {
    handled.current = true;
    goBack();
    handleSuccess(true);
  }, [handleSuccess, goBack]);

  const handleCancel = useCallback(() => {
    handled.current = true;
    goBack();
    handleSuccess(false);
  }, [handleSuccess, goBack]);

  const onPressAndroid = useCallback(() => {
    androidShowNetworksActionSheet(({ chainId }) => setApprovalChainId(chainId));
  }, []);

  const handlePressChangeWallet = useCallback(() => {
    type === WalletConnectApprovalSheetType.connect &&
      Navigation.handleAction(Routes.CHANGE_WALLET_SHEET, {
        currentAccountAddress: approvalAccount.address,
        onChangeWallet: (address, wallet) => {
          setApprovalAccount({ address, wallet });
          goBack();
        },
        watchOnly: true,
      });
  }, [approvalAccount.address, goBack, type]);

  useEffect(() => {
    const waitingTime = (Date.now() - receivedTimestamp) / 1000;
    InteractionManager.runAfterInteractions(() => {
      analytics.track('Received wc connection', {
        dappName,
        dappUrl,
        waitingTime: isNaN(waitingTime) ? 'Error calculating waiting time.' : waitingTime,
      });
    });
  }, [dappName, dappUrl, receivedTimestamp]);

  useEffect(() => {
    if (!timedOut) return;
    goBack();
    navigate(Routes.EXPLAIN_SHEET, {
      type: failureExplainSheetVariant || 'failed_wc_connection',
    });
    return;
  }, [failureExplainSheetVariant, goBack, navigate, timedOut]);

  const menuItems = useMemo(() => networksMenuItems(), []);
  const NetworkSwitcherParent =
    type === WalletConnectApprovalSheetType.connect && menuItems.length > 1 ? ContextMenuButton : React.Fragment;

  const sheetHeight = type === WalletConnectApprovalSheetType.connect ? 408 : 438;

  const renderNetworks = useCallback(() => {
    if (isWalletConnectV2) {
      if (!chainIds?.length) {
        return (
          <Box height={{ custom: 38 }} justifyContent="center" width="full">
            <LabelText align="right">{lang.t('walletconnect.none')}</LabelText>
          </Box>
        );
      } else {
        return <NetworkPill chainIds={chainIds} />;
      }
    } else {
      return (
        <NetworkSwitcherParent
          activeOpacity={0}
          isMenuPrimaryAction
          {...(android ? { onPress: onPressAndroid } : {})}
          menuConfig={{
            menuItems,
            menuTitle: lang.t('walletconnect.available_networks'),
          }}
          onPressMenuItem={handleOnPressNetworksMenuItem}
          useActionSheetFallback={false}
          wrapNativeComponent={false}
        >
          <ButtonPressAnimation
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              height: 38,
            }}
          >
            <Centered marginRight={5}>
              <ChainLogo chainId={type === WalletConnectApprovalSheetType.connect ? approvalNetworkInfo.chainId : Number(chainId)} />
            </Centered>
            <LabelText align="right" numberOfLines={1}>
              {`${
                type === WalletConnectApprovalSheetType.connect ? approvalNetworkInfo.name : chainsLabel[chainId]
              } ${type === WalletConnectApprovalSheetType.connect && menuItems.length > 1 ? '􀁰' : ''}`}
            </LabelText>
          </ButtonPressAnimation>
        </NetworkSwitcherParent>
      );
    }
  }, [
    NetworkSwitcherParent,
    approvalNetworkInfo.chainId,
    approvalNetworkInfo.name,
    chainId,
    chainIds,
    handleOnPressNetworksMenuItem,
    isWalletConnectV2,
    menuItems,
    onPressAndroid,
    type,
  ]);

  return (
    <Sheet>
      {!Object.keys(meta).length ? (
        <Centered height={sheetHeight}>
          <LoadingSpinner />
        </Centered>
      ) : (
        <Flex direction="column">
          <Centered direction="column" paddingBottom={5} paddingHorizontal={19} paddingTop={17} testID="wc-approval-sheet">
            <DappLogo dappName={dappName || ''} imageUrl={imageUrl} />
            <Centered paddingHorizontal={24}>
              <Column>
                <Row justify="center" marginBottom={12}>
                  <Text align="center" color="primary (Deprecated)" numberOfLines={1} size="23px / 27px (Deprecated)" weight="heavy">
                    {dappName}
                  </Text>
                </Row>
                <Text align="center" color="secondary60 (Deprecated)" size="23px / 27px (Deprecated)" weight="semibold">
                  {type === WalletConnectApprovalSheetType.connect
                    ? lang.t(lang.l.walletconnect.wants_to_connect)
                    : lang.t(lang.l.walletconnect.wants_to_connect_to_network, {
                        network: chainsLabel[chainId],
                      })}
                </Text>
              </Column>
            </Centered>
            <Row marginBottom={30} marginTop={30}>
              {formattedDappUrl && (
                <Text color={{ custom: accentColor }} size="18px / 27px (Deprecated)" weight="heavy">
                  {isScam && '􁅏 '}
                  {isVerified && '􀇻 '}
                  {formattedDappUrl}
                </Text>
              )}
            </Row>
            <Divider color={colors.rowDividerLight} inset={[0, 84]} />
          </Centered>
          {isScam && (
            <Box paddingHorizontal={'16px'} testID={'malicious-dapp-warning'}>
              <InfoAlert
                rightIcon={
                  <Text size="15pt" color={{ custom: accentColor }}>
                    􀘰
                  </Text>
                }
                title={lang.t(lang.l.walletconnect.dapp_warnings.info_alert.title)}
                description={lang.t(lang.l.walletconnect.dapp_warnings.info_alert.description)}
              />
            </Box>
          )}
          <SheetActionButtonRow paddingBottom={android ? 20 : 30}>
            <SheetActionButton
              color={colors.white}
              label={lang.t('button.cancel')}
              onPress={handleCancel}
              size="big"
              textColor={colors.alpha(colors.blueGreyDark, 0.8)}
              weight="bold"
            />
            <SheetActionButton
              color={accentColor}
              label={lang.t('button.connect')}
              onPress={handleConnect}
              size="big"
              testID="wc-connect"
              weight="heavy"
            />
          </SheetActionButtonRow>
          <Box paddingBottom={{ custom: 21 }} paddingHorizontal={{ custom: 24 }}>
            <Columns>
              <RDSColumn>
                <SwitchText>{lang.t('wallet.wallet_title')}</SwitchText>
                <ButtonPressAnimation
                  onPress={handlePressChangeWallet}
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    height: 38,
                  }}
                >
                  {approvalAccountInfo.accountImage ? (
                    <ImageAvatar image={approvalAccountInfo.accountImage} size="smaller" />
                  ) : (
                    <ContactAvatar
                      color={isNaN(approvalAccountInfo.accountColor) ? colors.skeleton : approvalAccountInfo.accountColor}
                      size="smaller"
                      value={approvalAccountInfo.accountSymbol}
                    />
                  )}
                  <Box
                    // avatar width (22) + avatar right margin (5)
                    paddingLeft={{ custom: 5 }}
                    width="full"
                    flexDirection="row"
                  >
                    <LabelText style={{ maxWidth: '80%' }}>{`${approvalAccountInfo.accountLabel}`}</LabelText>
                    <LabelText>{type === WalletConnectApprovalSheetType.connect ? '􀁰' : ''}</LabelText>
                  </Box>
                </ButtonPressAnimation>
              </RDSColumn>
              {/* spacer */}
              <RDSColumn width={{ custom: 6 }} />
              <RDSColumn width="content">
                <Flex justify="end">
                  <SwitchText align="right">
                    {chainIds.length > 1
                      ? lang.t(lang.l.walletconnect.approval_sheet_networks, {
                          length: chainIds.length,
                        })
                      : lang.t(lang.l.walletconnect.approval_sheet_network)}
                  </SwitchText>
                </Flex>
                {renderNetworks()}
              </RDSColumn>
            </Columns>
          </Box>
        </Flex>
      )}
    </Sheet>
  );
}
