import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Manager } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CallScreen } from './screens/CallScreen';
import { IncomingCallScreen } from './screens/IncomingCallScreen';

const SOCKET_URL = 'http://192.168.23.229:5000';
const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const socketRef = useRef<any>(null);
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const setupSocket = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.error('No token available for socket connection');
      return;
    }

    const manager = new Manager(`${SOCKET_URL}?token=${token}`, {
      autoConnect: false
    });

    socketRef.current = manager.socket('/');

    socketRef.current.on('incoming_call', (data: { callerId: string; mode: 'audio' | 'video' }) => {
      navigationRef.current?.navigate('IncomingCall', {
        callerName: data.callerId,
        mode: data.mode,
        onAccept: () => {
          socketRef.current.emit('call_accepted', { callerId: data.callerId });
          navigationRef.current?.navigate('Call', {
            userId: data.callerId,
            mode: data.mode,
          });
        },
        onDecline: () => {
          socketRef.current.emit('call_rejected', { callerId: data.callerId });
        },
      });
    });

    socketRef.current.connect();
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Call" component={CallScreen} />
        <Stack.Screen 
          name="IncomingCall" 
          component={IncomingCallScreen}
          options={{
            presentation: 'transparentModal',
            animationEnabled: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export type RootStackParamList = {
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