import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Manager } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, LogBox } from 'react-native';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ChatScreen } from './screens/ChatScreen';
import { CallScreen } from './screens/CallScreen';
import { IncomingCallScreen } from './screens/IncomingCallScreen';

// Ignore specific warnings that might interfere with the modal
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Sending...',
]);

const SOCKET_URL = 'http://192.168.23.229:5000';
const Stack = createNativeStackNavigator<RootStackParamList>();

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Chat: {
    userId: string;
  };
  Call: {
    userId: string;
    mode: 'audio' | 'video';
  };
  IncomingCall: {
    callerName: string;
    mode: 'audio' | 'video';
    onAccept: () => void;
    onDecline: () => void;
  };
};

export default function App() {
  const socketRef = useRef<any>(null);
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    console.log('[App] Initializing...');
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const setupSocket = async () => {
    console.log('[App] Setting up socket connection...');
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.log('[App] No token found, skipping socket setup');
      return;
    }

    const manager = new Manager(`${SOCKET_URL}?token=${token}`, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socketRef.current = manager.socket('/');

    socketRef.current.on('connect', () => {
      console.log('[App] Socket connected successfully');
    });

    socketRef.current.on('disconnect', () => {
      console.log('[App] Socket disconnected');
    });

    socketRef.current.on('connect_error', (error: any) => {
      console.error('[App] Socket connection error:', error);
    });

    socketRef.current.on('incoming_call', (data: { callerId: string; mode: 'audio' | 'video' }) => {
      console.log('[App] Incoming call received:', data);
      
      try {
        if (navigationRef.current) {
          console.log('[App] Attempting to show incoming call screen...');
          navigationRef.current.navigate('IncomingCall', {
            callerName: data.callerId,
            mode: data.mode,
            onAccept: () => {
              console.log('[App] Call accepted, emitting acceptance');
              socketRef.current.emit('call_accepted', { callerId: data.callerId });
              navigationRef.current.navigate('Call', {
                userId: data.callerId,
                mode: data.mode,
              });
            },
            onDecline: () => {
              console.log('[App] Call declined, emitting rejection');
              socketRef.current.emit('call_rejected', { callerId: data.callerId });
            },
          });
          console.log('[App] Successfully navigated to incoming call screen');
        } else {
          console.error('[App] Navigation ref is not available');
          Alert.alert('Error', 'Cannot show incoming call screen - navigation not ready');
        }
      } catch (error) {
        console.error('[App] Error showing incoming call screen:', error);
        Alert.alert('Error', 'Failed to show incoming call screen');
      }
    });

    socketRef.current.on('error', (error: any) => {
      console.error('[App] Socket error:', error);
    });

    console.log('[App] Connecting socket...');
    socketRef.current.connect();
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={(state) => {
        console.log('[Navigation] State changed:', state?.routes[state.routes.length - 1]);
      }}
    >
      <Stack.Navigator initialRouteName="Login">
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Call" component={CallScreen} />
        </Stack.Group>
        <Stack.Group screenOptions={{ 
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
        }}>
          <Stack.Screen 
            name="IncomingCall" 
            component={IncomingCallScreen}
            options={{
              gestureEnabled: false,
            }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
} 