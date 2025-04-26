import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { CallScreen } from './src/screens/CallScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  ChatList: undefined;
  Chat: {
    userId: string;
    userName: string;
  };
  Call: {
    mode: 'voice' | 'video';
    userId: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a1a',
          },
          headerTitleStyle: {
            color: '#ffffff',
            fontSize: 24,
            fontWeight: 'bold',
          },
          headerTintColor: '#ffffff',
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Register" 
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="ChatList" 
          component={ChatListScreen}
          options={{ 
            headerShown: true,
            title: 'Chats',
            headerStyle: {
              backgroundColor: '#1a1a1a',
            },
            headerTitleStyle: {
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 'bold',
            },
            headerTintColor: '#ffffff',
          }}
        />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{ 
            headerShown: true,
            headerStyle: {
              backgroundColor: '#ffffff',
              elevation: 3,
              borderBottomWidth: 1,
              borderBottomColor: '#E8E8E8',
            },
            headerTitleStyle: {
              color: '#000000',
              fontSize: 18,
              fontWeight: '600',
            },
            headerTintColor: '#007AFF',
          }}
        />
        <Stack.Screen 
          name="Call" 
          component={CallScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
