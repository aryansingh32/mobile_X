import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';
import CoinCounter from '../components/ui/CoinCounter';
import { getCatalog, getHistory, getSuggestions, postSuggestion, requestWithdrawal, getMyWithdrawals } from '../api/wallet';
import { getProfile } from '../api/user';
import { Coins, Gift, IndianRupee, Send, ShoppingBag, BadgeInfo, ArrowRight } from 'lucide-react-native';
import { useContent } from '../hooks/useContent';
import RedemptionSuccessScreen from './RedemptionSuccessScreen';
import { useToast } from '../components/ui/Toast';
import { VIBIcon } from '../components/ui/VIBIcon';

export const WalletScreen = () => {
  const mountedRef = React.useRef(true);
  React.useEffect(() => { return () => { mountedRef.current = false; } }, []);

  const {
    coinBalance,
    setBalance,
    coinToInrRate,
    minWithdrawalCoins,
    setConfigValues,
  } = useAppStore(useShallow(s => ({ coinBalance: s.coinBalance, setBalance: s.setBalance, coinToInrRate: s.coinToInrRate, minWithdrawalCoins: s.minWithdrawalCoins, setConfigValues: s.setConfigValues })));

  const [activeTab, setActiveTab] = useState<'catalog' | 'rewards' | 'history' | 'suggest'>('catalog');
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionText, setSuggestionText] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [destinationId, setDestinationId] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ itemName: string; coinsSpent: number; detail?: string } | null>(null);
  const { showToast } = useToast();

  const walletBalanceLabel = useContent('wallet.balance_label', 'Wallet balance');
  const walletRedeemTitle = useContent('wallet.redeem_title', 'Redeem Your VIB');

  const refreshWalletProfile = async () => {
    const profile = await getProfile();
    setBalance(profile?.coins ?? coinBalance);
    setConfigValues({
      coinToInrRate: profile?.coinToInrRate ?? profile?.config?.coin_to_inr_rate ?? coinToInrRate,
      minWithdrawalCoins: profile?.minWithdrawalCoins ?? profile?.config?.min_withdrawal_coins ?? minWithdrawalCoins,
      adRewardedCoins: profile?.config?.ad_rewarded_coins,
      adRewardedInterstitialCoins: profile?.config?.ad_rewarded_interstitial_coins,
      adRewardedDiscoverCoins: profile?.config?.ad_rewarded_discover_coins,
    });
  };

  const loadData = async (mounted = true) => {
    try {
      if (!mounted) return;
      setError('');
      await refreshWalletProfile();
      if (!mounted) return;
      if (activeTab === 'catalog') {
        const res = await getCatalog();
        if (mounted) setCatalog(res || []);
      } else if (activeTab === 'suggest') {
        const res = await getSuggestions();
        if (mounted) setSuggestions(res || []);
      } else if (activeTab === 'rewards') {
        const res = await getMyWithdrawals();
        if (mounted) setRewards(res.data || []);
      } else {
        const res = await getHistory();
        if (mounted) setHistory(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load wallet data', err);
      if (mounted) setError('Could not load wallet data.');
    } finally {
      if (mounted) if (mountedRef.current) setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    if (mountedRef.current) setLoading(true);
    loadData(mounted);
    return () => { mounted = false; };
  }, [activeTab]);

  const handleRedeem = async () => {
    const isPhysical = selectedItem?.type === 'PHYSICAL';
    const isVoucher = selectedItem?.type === 'VOUCHER';
    
    if (isPhysical) {
        if (!deliveryAddress.trim() || !mobileNumber.trim()) {
            showToast('Enter your delivery address and mobile number.', 'error');
            return;
        }
    } else if (!isVoucher && !destinationId.trim()) {
      showToast('Enter the UPI ID, email, or account identifier for this reward.', 'error');
      return;
    }
    try {
      if (mountedRef.current) setSubmitting(true);
      const result = await requestWithdrawal({
        catalogItemId: selectedItem.id,
        destinationId: !isVoucher && !isPhysical ? destinationId.trim() : undefined,
        size: isPhysical ? size : undefined,
        color: isPhysical ? color : undefined,
        deliveryAddress: isPhysical ? deliveryAddress.trim() : undefined,
        mobileNumber: isPhysical ? mobileNumber.trim() : undefined,
      });
      await refreshWalletProfile();
      const itemName = selectedItem.name;
      const coinsSpent = selectedItem.coinCost;
      setSelectedItem(null);
      setDestinationId('');
      setSize('');
      setColor('');
      setDeliveryAddress('');
      setMobileNumber('');
      // "Big win" confirmation moment gets a full success screen instead of a
      // plain system alert — see RedemptionSuccessScreen.tsx.
      setSuccessInfo({
        itemName,
        coinsSpent,
        detail: result.redemptionCode?.code
          ? `Code: ${result.redemptionCode.code}${result.redemptionCode.serialNumber ? ` · Serial: ${result.redemptionCode.serialNumber}` : ''}`
          : 'Your request is now pending review.',
      });
      setActiveTab('rewards');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Redemption failed — please try again.', 'error');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleSuggest = async () => {
    if (!suggestionText.trim()) return;
    try {
      await postSuggestion(suggestionText);
      setSuggestionText('');
      loadData();
    } catch (err) {
      console.error('Failed to suggest', err);
    }
  };

  const minInr = useMemo(() => (minWithdrawalCoins * coinToInrRate).toFixed(2), [minWithdrawalCoins, coinToInrRate]);
  const walletProgress = useMemo(() => Math.min(1, coinBalance / Math.max(1, minWithdrawalCoins)), [coinBalance, minWithdrawalCoins]);

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['catalog', 'rewards', 'history', 'suggest'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.label}>{walletBalanceLabel}</Text>
            <CoinCounter value={coinBalance} size="hero" />
          </View>
          <View style={styles.inrPill}>
            <IndianRupee size={16} color="#FFD700" />
            <Text style={styles.inrPillText}>₹{(coinBalance * coinToInrRate).toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.thresholdCard}>
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>Minimum redemption</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.thresholdValue}>{minWithdrawalCoins} </Text>
              <VIBIcon size={14} />
            </View>
          </View>
          <Text style={styles.thresholdSub}>₹{minInr} at the current exchange rate</Text>
          <View style={{ marginTop: 14 }}>
            <AnimatedProgressBar progress={walletProgress} height={8} showPercentage />
          </View>
        </View>
      </View>

      {renderTabs()}

      <ScrollView style={styles.content}>
        {error ? (
          <TouchableOpacity style={styles.errorCard} onPress={() => loadData()}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}
        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Loading wallet...</Text>
          </View>
        ) : activeTab === 'catalog' ? (
          <View>
            <Text style={styles.sectionTitle}>{walletRedeemTitle}</Text>
            {catalog.length === 0 ? (
              <Text style={styles.emptyText}>Coming soon — check back later!</Text>
            ) : (
              <View style={styles.grid}>
                {catalog.map(item => {
                  const canAfford = coinBalance >= item.coinCost;
                  const soldOut = Boolean(item.soldOut);
                  const cashValue = (item.coinCost * coinToInrRate).toFixed(2);
                  return (
                    <TouchableOpacity key={item.id} style={[styles.catalogCard, (!canAfford || soldOut) && styles.catalogCardDisabled]} onPress={() => canAfford && !soldOut && setSelectedItem(item)} activeOpacity={0.85}>
                      <View style={styles.itemTypeBadge}>
                        {item.type === 'UPI' ? <IndianRupee size={16} color="#FFF" /> : <Gift size={16} color="#FFF" />}
                      </View>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <ShoppingBag size={28} color="rgba(255,255,255,0.2)" />
                        </View>
                      )}
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemInr}>₹{item.inrValue}</Text>
                      <Text style={[styles.stockText, soldOut && styles.soldOutText]}>
                        {soldOut ? 'Sold out' : item.availableStock === -1 ? 'Available' : `${item.availableStock} available`}
                      </Text>
                      <View style={styles.costRow}>
                        <VIBIcon size={14} />
                        <Text style={styles.costText}>{item.coinCost}</Text>
                      </View>
                      <Text style={styles.valueText}>≈ ₹{cashValue}</Text>
                      <View style={styles.redeemBtn}>
                        <Text style={styles.redeemBtnText}>{soldOut ? 'Sold out' : canAfford ? 'Redeem' : 'Insufficient balance'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        
        ) : activeTab === 'rewards' ? (
          <View>
            <Text style={styles.sectionTitle}>My Rewards</Text>
            {rewards.length === 0 ? (
              <Text style={styles.emptyText}>You haven't redeemed anything yet.</Text>
            ) : rewards.map(entry => (
              <View key={entry.id} style={styles.historyCard}>
                {entry.catalogItem?.imageUrl ? (
                  <Image source={{ uri: entry.catalogItem.imageUrl }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#1E1E1E', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Gift size={20} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.historySource}>{entry.catalogItem?.name || 'Reward'}</Text>
                  <Text style={styles.historyDate}>{new Date(entry.requestedAt).toLocaleString()}</Text>
                  {entry.status === 'APPROVED' && entry.catalogCode?.code && (
                    <Text style={{ color: '#FFD700', fontSize: 13, marginTop: 4, fontWeight: 'bold' }}>Code: {entry.catalogCode.code}</Text>
                  )}
                  {entry.trackingId && (
                    <Text style={{ color: '#4CAF50', fontSize: 13, marginTop: 4 }}>Track: {entry.trackingId}</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: entry.status === 'APPROVED' || entry.status === 'SHIPPED' || entry.status === 'DELIVERED' ? '#4CAF50' : entry.status === 'REJECTED' ? '#FF6B6B' : '#2A2A2A' }]}>
                   <Text style={styles.statusText}>{entry.status}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : activeTab === 'suggest' ? (
          <View>
            <Text style={styles.sectionTitle}>What reward would you like to see?</Text>
            <View style={styles.suggestInputBox}>
              <TextInput
                style={styles.input}
                placeholder="E.g., Netflix Gift Card, Amazon Pay..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={suggestionText}
                onChangeText={setSuggestionText}
                maxLength={200}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSuggest}>
                <Send size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionTitle}>Your Suggestions</Text>
            {suggestions.length === 0 ? <Text style={styles.emptyText}>You have not submitted any suggestions yet.</Text> : null}
            {suggestions.map((s, idx) => (
              <View key={idx} style={styles.suggestionCard}>
                <Text style={styles.suggestionText}>{s.message}</Text>
                <View style={[styles.statusBadge, { backgroundColor: s.status === 'ADDED' ? '#4CAF50' : '#2A2A2A' }]}>
                  <Text style={styles.statusText}>{s.status}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>No wallet activity yet.</Text>
            ) : history.map(entry => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historySource}>{String(entry.source).replaceAll('_', ' ')}</Text>
                  <Text style={styles.historyDate}>{new Date(entry.timestamp).toLocaleString()}</Text>
                </View>
                <Text style={[styles.historyAmount, entry.amount < 0 && styles.historyDebit]}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {selectedItem ? (
        <View style={styles.redeemOverlay}>
          <View style={styles.redeemSheet}>
            <View style={styles.sheetTitleRow}>
              <View>
                <Text style={styles.sheetTitle}>Redeem {selectedItem.name}</Text>
                <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'}}>
                  <VIBIcon size={12} style={{marginRight: 4}} />
                  <Text style={styles.redeemHelp}>and INR values are driven by the admin economy config.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { setSelectedItem(null); setDestinationId(''); }} style={styles.closeBtn}>
                <XIcon />
              </TouchableOpacity>
            </View>
            {selectedItem.type === 'VOUCHER' ? (
              <View style={styles.instantCodeBox}>
                <Gift size={18} color="#FFD700" />
                <Text style={styles.instantCodeText}>A code will be issued instantly if available, or manually assigned.</Text>
              </View>
            ) : selectedItem.type === 'PHYSICAL' ? (
              <View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput style={[styles.destinationInput, { flex: 1, marginBottom: 10 }]} placeholder="Size (e.g. M, L)" placeholderTextColor="rgba(255,255,255,0.4)" value={size} onChangeText={setSize} />
                  <TextInput style={[styles.destinationInput, { flex: 1, marginBottom: 10 }]} placeholder="Color" placeholderTextColor="rgba(255,255,255,0.4)" value={color} onChangeText={setColor} />
                </View>
                <TextInput style={[styles.destinationInput, { marginBottom: 10 }]} placeholder="Mobile Number" placeholderTextColor="rgba(255,255,255,0.4)" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" />
                <TextInput style={[styles.destinationInput, { height: 80, textAlignVertical: 'top' }]} placeholder="Delivery Address" placeholderTextColor="rgba(255,255,255,0.4)" value={deliveryAddress} onChangeText={setDeliveryAddress} multiline />
              </View>
            ) : (
              <TextInput
                style={styles.destinationInput}
                placeholder={selectedItem.type === 'UPI' ? 'name@upi' : 'Email, address, or account ID'}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={destinationId}
                onChangeText={setDestinationId}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setSelectedItem(null); setDestinationId(''); }} disabled={submitting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, submitting && styles.redeemBtnDisabled]} onPress={handleRedeem} disabled={submitting}>
                <View style={styles.confirmTextContainer}>
                  {submitting ? <Text style={styles.confirmText}>Submitting…</Text> : (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={{color: '#fff', fontSize: 16, fontWeight: '700'}}>Confirm {selectedItem.coinCost} </Text>
                      <VIBIcon size={14} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {successInfo ? (
        <RedemptionSuccessScreen
          itemName={successInfo.itemName}
          coinsSpent={successInfo.coinsSpent}
          detail={successInfo.detail}
          onDone={() => setSuccessInfo(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const XIcon = () => <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900' }}>×</Text>;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 6 },
  inrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    backgroundColor: 'rgba(255,215,0,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  inrPillText: { color: '#FFD700', fontSize: 13, fontWeight: '800' },
  thresholdCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thresholdLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  thresholdValue: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  thresholdSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 6 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: { paddingBottom: 8, flex: 1, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '700' },
  activeTabText: { color: '#FFF' },
  content: { flex: 1, padding: 16 },
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.5)' },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  emptyText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catalogCard: {
    width: '48%',
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catalogCardDisabled: { opacity: 0.55 },
  itemTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4D1A',
    padding: 6,
    borderRadius: 12,
    zIndex: 1,
  },
  itemImagePlaceholder: {
    height: 80,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  itemImage: {
    height: 80,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#1E1E1E',
  },
  itemName: { color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  itemInr: { color: '#4CAF50', fontSize: 12, marginBottom: 8 },
  stockText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 8 },
  soldOutText: { color: '#FF6B6B', fontWeight: '800' },
  costRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  costText: { color: '#FFD700', fontSize: 14, fontWeight: '800', marginLeft: 4 },
  valueText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 12 },
  redeemBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnDisabled: {
    opacity: 0.6,
    backgroundColor: '#333',
  },
  redeemBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  suggestInputBox: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
    padding: 4,
  },
  input: { flex: 1, color: '#FFF', paddingHorizontal: 12, fontSize: 14 },
  sendBtn: { backgroundColor: '#FFD700', padding: 12, borderRadius: 8 },
  suggestionCard: {
    backgroundColor: '#161616',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionText: { color: '#FFF', flex: 1, marginRight: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  errorCard: { backgroundColor: 'rgba(255,77,26,0.12)', borderColor: '#FF4D1A', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#FFF', textAlign: 'center' },
  historyCard: { backgroundColor: '#161616', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  historySource: { color: '#FFF', fontWeight: '800', textTransform: 'capitalize' },
  historyDate: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },
  historyAmount: { color: '#4CAF50', fontSize: 18, fontWeight: '900' },
  historyDebit: { color: '#FF6B6B' },
  redeemOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 50 },
  redeemSheet: { backgroundColor: '#161616', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E1E1E' },
  redeemHelp: { color: 'rgba(255,255,255,0.6)', lineHeight: 20, fontSize: 13 },
  destinationInput: { backgroundColor: '#0A0A0A', color: '#FFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 20 },
  instantCodeBox: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', borderRadius: 10, padding: 14, marginBottom: 20 },
  instantCodeText: { color: '#FFF', flex: 1, fontSize: 13, lineHeight: 18 },
  sheetActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  cancelText: { color: '#FFF', fontWeight: '800' },
  confirmBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#FFD700', alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: '900' },
});
