const fs = require('fs');
const file = '/home/unknown/Desktop/mobile_X/modified2/reel-flow/src/screens/WalletScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { getCatalog, getHistory, getSuggestions, postSuggestion, requestWithdrawal } from '../api/wallet';",
  "import { getCatalog, getHistory, getSuggestions, postSuggestion, requestWithdrawal, getMyWithdrawals } from '../api/wallet';"
);

content = content.replace(
  "const [activeTab, setActiveTab] = useState<'catalog' | 'history' | 'suggest'>('catalog');",
  "const [activeTab, setActiveTab] = useState<'catalog' | 'rewards' | 'history' | 'suggest'>('catalog');"
);

content = content.replace(
  "const [history, setHistory] = useState<any[]>([]);",
  "const [history, setHistory] = useState<any[]>([]);\n  const [rewards, setRewards] = useState<any[]>([]);"
);

content = content.replace(
  "const [destinationId, setDestinationId] = useState('');",
  "const [destinationId, setDestinationId] = useState('');\n  const [size, setSize] = useState('');\n  const [color, setColor] = useState('');\n  const [deliveryAddress, setDeliveryAddress] = useState('');\n  const [mobileNumber, setMobileNumber] = useState('');"
);

content = content.replace(
  "} else if (activeTab === 'suggest') {\n        const res = await getSuggestions();\n        if (mounted) setSuggestions(res || []);\n      } else {",
  "} else if (activeTab === 'suggest') {\n        const res = await getSuggestions();\n        if (mounted) setSuggestions(res || []);\n      } else if (activeTab === 'rewards') {\n        const res = await getMyWithdrawals();\n        if (mounted) setRewards(res.data || []);\n      } else {"
);

content = content.replace(
  /const handleRedeem = async \(\) => \{[\s\S]*?try \{/m,
  `const handleRedeem = async () => {
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
    try {`
);

content = content.replace(
  /const result = await requestWithdrawal\(\{\n        catalogItemId: selectedItem\.id,\n        destinationId: requiresDestination \? destinationId\.trim\(\) : undefined,\n      \}\);/,
  `const result = await requestWithdrawal({
        catalogItemId: selectedItem.id,
        destinationId: !isVoucher && !isPhysical ? destinationId.trim() : undefined,
        size: isPhysical ? size : undefined,
        color: isPhysical ? color : undefined,
        deliveryAddress: isPhysical ? deliveryAddress.trim() : undefined,
        mobileNumber: isPhysical ? mobileNumber.trim() : undefined,
      });`
);

content = content.replace(
  "setDestinationId('');",
  "setDestinationId('');\n      setSize('');\n      setColor('');\n      setDeliveryAddress('');\n      setMobileNumber('');"
);

content = content.replace(
  "setActiveTab('history');",
  "setActiveTab('rewards');"
);

content = content.replace(
  "{(['catalog', 'history', 'suggest'] as const).map((tab) => (",
  "{(['catalog', 'rewards', 'history', 'suggest'] as const).map((tab) => ("
);

const rewardsTabCode = `
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
`;
content = content.replace(
  /(\) : activeTab === 'suggest' \? \()/m,
  rewardsTabCode + "        $1"
);

const physicalFormCode = `            {selectedItem.type === 'VOUCHER' ? (
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
            ) : (`

content = content.replace(
  /\{selectedItem\.type === 'VOUCHER' \? \([\s\S]*?\} \)/m,
  physicalFormCode
);

fs.writeFileSync(file, content);
console.log('Patched WalletScreen.tsx');
