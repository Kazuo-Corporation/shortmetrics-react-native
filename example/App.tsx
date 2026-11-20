import React, { useEffect, useState } from 'react';
import { View, Button, Text, StyleSheet, ScrollView } from 'react-native';
import { ShortMetrics } from '@kazuocorporation/shortmetrics-react-native';

// Configure tracker (do this once in your app's entry point)
ShortMetrics.configure({
  apiKey: 'evt2_YOUR_KEY_HERE', // Replace with your actual key
  autoTrackSessions: true,
});

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Ready');

  useEffect(() => {
    // Initialize tracker
    ShortMetrics.initialize().then(() => {
      setStatus('Tracker initialized');
    });

    return () => {
      ShortMetrics.reset();
    };
  }, []);

  const handleLogin = async () => {
    const newUserId = `user_${Date.now()}`;
    setUserId(newUserId);
    
    // Identify user
    await ShortMetrics.identify(
      newUserId,
      'user@example.com',
      '+1234567890'
    );
    
    setStatus('User identified');
  };

  const handlePurchase = async () => {
    await ShortMetrics.trackPredefined('purchase', {
      amount: 99.99,
      currency: 'USD',
      product: 'Premium Plan',
    });
    
    setStatus('Purchase tracked');
  };

  const handleAppInstalled = async () => {
    await ShortMetrics.trackPredefined('app_installed');
    setStatus('App install tracked');
  };

  const handleCustomEvent = async () => {
    await ShortMetrics.trackCustom('button_clicked', {
      properties: {
        button_name: 'test_button',
        screen: 'home',
        timestamp: Date.now(),
      },
    });
    
    setStatus('Custom event tracked');
  };

  const handleFeatureUsed = async () => {
    await ShortMetrics.trackCustom('feature_used', {
      properties: {
        feature_name: 'dark_mode',
        enabled: true,
      },
    });
    
    setStatus('Feature usage tracked');
  };

  const handleLogout = async () => {
    await ShortMetrics.clearIdentity();
    setUserId(null);
    setStatus('User logged out');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>ShortMetrics Demo</Text>
        <Text style={styles.status}>Status: {status}</Text>
        <Text style={styles.userInfo}>
          User ID: {userId || 'Not logged in'}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Management</Text>
          {!userId ? (
            <Button title="Login" onPress={handleLogin} />
          ) : (
            <Button title="Logout" onPress={handleLogout} color="#ff4444" />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predefined Events</Text>
          <View style={styles.buttonRow}>
            <Button title="App Installed" onPress={handleAppInstalled} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Track Purchase" onPress={handlePurchase} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Events</Text>
          <View style={styles.buttonRow}>
            <Button title="Custom Event" onPress={handleCustomEvent} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Feature Used" onPress={handleFeatureUsed} />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  status: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  userInfo: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  buttonRow: {
    marginVertical: 5,
  },
});

