import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type IncomingCallRouteProp = RouteProp<RootStackParamList, 'IncomingCall'>;

export const IncomingCallScreen = () => {
  const route = useRoute<IncomingCallRouteProp>();
  const navigation = useNavigation();
  const [pulseAnim] = React.useState(new Animated.Value(1));
  const { callerName, mode, onAccept, onDecline } = route.params;

  useEffect(() => {
    console.log('[IncomingCall] Screen mounted for caller:', callerName);
    
    // Start pulsing animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    
    pulseAnimation.start();
    console.log('[IncomingCall] Started pulse animation');

    // Vibrate phone
    const pattern = [0, 1000, 1000];
    const interval = setInterval(() => {
      Vibration.vibrate(pattern);
    }, 3000);

    console.log('[IncomingCall] Started vibration pattern');

    return () => {
      console.log('[IncomingCall] Cleaning up...');
      Vibration.cancel();
      clearInterval(interval);
      pulseAnimation.stop();
    };
  }, [callerName]);

  const handleAccept = () => {
    console.log('[IncomingCall] Call accepted');
    onAccept();
    navigation.goBack();
  };

  const handleDecline = () => {
    console.log('[IncomingCall] Call declined');
    onDecline();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.avatarContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Icon name="person" size={80} color="#666" />
        </Animated.View>

        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callType}>
          Incoming {mode === 'video' ? 'Video' : 'Audio'} Call
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={handleDecline}
          >
            <Icon name="call-end" size={36} color="white" />
            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Icon name={mode === 'video' ? 'videocam' : 'call'} size={36} color="white" />
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  callerName: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  callType: {
    color: '#999',
    fontSize: 18,
    marginBottom: 40,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    marginTop: 4,
    fontSize: 12,
  },
}); 