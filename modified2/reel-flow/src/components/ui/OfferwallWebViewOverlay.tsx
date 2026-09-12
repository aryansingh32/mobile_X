import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  url: string | null;
  onClose: () => void;
};

// Real third-party offerwall network wall — a plain WebView pointed at
// whatever URL the admin configured (see getOfferwallWall). The network's
// own S2S postback credits coins server-side; this component has no
// involvement in that, it just displays the wall.
export const OfferwallWebViewOverlay: React.FC<Props> = ({ url, onClose }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (!url) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close offers">
          <ArrowLeft color="#FFF" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>More Offers</Text>
      </View>
      <View style={styles.webViewWrap}>
        {!loadError && (
          <WebView
            key={reloadKey}
            source={{ uri: url }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            onLoadStart={() => { setLoading(true); setLoadError(false); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setLoadError(true); }}
            onHttpError={() => { setLoading(false); setLoadError(true); }}
          />
        )}
        {loading && !loadError ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#FFD700" />
            <Text style={styles.loaderText}>Loading offers…</Text>
          </View>
        ) : null}
        {loadError ? (
          <View style={styles.loader}>
            <Text style={styles.loaderText}>Couldn't load offers right now.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setLoadError(false); setReloadKey((k) => k + 1); }}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111', zIndex: 9999, elevation: 9999 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#111',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: '800', marginLeft: 16 },
  webViewWrap: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, backgroundColor: '#000' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: { color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 14, fontWeight: '600' },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2A2A2A',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

export default OfferwallWebViewOverlay;
