import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  SafeAreaView,
  Image,
  Animated,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Manager } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const SOCKET_URL = 'http://192.168.23.229:5000';
const WEBRTC_URL = 'https://webrtc.github.io/samples/src/content/peerconnection/pc1/';

type CallScreenRouteProp = RouteProp<RootStackParamList, 'Call'>;

export const CallScreen = () => {
  const route = useRoute<CallScreenRouteProp>();
  const navigation = useNavigation();
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const socketRef = useRef<any>(null);
  const webViewRef = useRef<WebView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isVideoMode = route.params.mode === 'video';

  useEffect(() => {
    console.log('[CallScreen] Initializing with mode:', route.params.mode);
    setupSocket();
    setupPulseAnimation();
    return () => {
      if (socketRef.current) {
        console.log('[CallScreen] Cleaning up socket connection');
        socketRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isCallConnected) {
      startTimer();
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isCallConnected]);

  const setupPulseAnimation = () => {
    Animated.loop(
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
    ).start();
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setupSocket = async () => {
    console.log('[CallScreen] Setting up socket connection');
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.error('[CallScreen] No token available for socket connection');
      return;
    }

    const manager = new Manager(`${SOCKET_URL}?token=${token}`, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketRef.current = manager.socket('/');
    
    socketRef.current.on('connect', () => {
      console.log('[CallScreen] Socket connected, initiating call request');
      socketRef.current.emit('call_request', {
        targetUserId: route.params.userId,
        mode: route.params.mode,
      });
    });

    socketRef.current.on('call_accepted', () => {
      console.log('[CallScreen] Call accepted by receiver');
      setIsCallConnected(true);
    });

    socketRef.current.on('call_rejected', () => {
      console.log('[CallScreen] Call rejected by receiver');
      Alert.alert('Call Rejected', 'The user rejected your call');
      navigation.goBack();
    });

    socketRef.current.on('call_ended', () => {
      console.log('[CallScreen] Call ended by other user');
      Alert.alert('Call Ended', 'The other user ended the call');
      navigation.goBack();
    });

    socketRef.current.connect();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isVideoMode && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        const audioTracks = window.localStream.getAudioTracks();
        audioTracks.forEach(track => track.enabled = ${isMuted});
        true;
      `);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const toggleVideo = () => {
    if (isVideoMode) {
      setIsVideoEnabled(!isVideoEnabled);
      webViewRef.current?.injectJavaScript(`
        const videoTracks = window.localStream.getVideoTracks();
        videoTracks.forEach(track => track.enabled = ${!isVideoEnabled});
        true;
      `);
    }
  };

  const endCall = () => {
    console.log('[CallScreen] Ending call');
    if (socketRef.current) {
      socketRef.current.emit('call_ended', {
        targetUserId: route.params.userId,
      });
    }
    navigation.goBack();
  };

  const onWebViewMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'webrtc_ready') {
      setIsCallConnected(true);
    }
  };

  const renderAudioCallUI = () => (
    <View style={styles.audioCallContainer}>
      <View style={styles.callerInfoContainer}>
        <Animated.View 
          style={[
            styles.avatarContainer,
            !isCallConnected && {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Icon name="person" size={80} color="#666" />
        </Animated.View>
        <Text style={styles.callerName}>{route.params.userId}</Text>
        <Text style={[
          styles.callStatus,
          isCallConnected && styles.callStatusConnected
        ]}>
          {isCallConnected ? 'Connected' : 'Calling...'}
        </Text>
        {isCallConnected && (
          <Text style={styles.callDuration}>
            {formatDuration(callDuration)}
          </Text>
        )}
      </View>

      <View style={styles.statusIndicators}>
        {isMuted && (
          <View style={styles.indicator}>
            <Icon name="mic-off" size={16} color="#FF3B30" />
            <Text style={styles.indicatorText}>Muted</Text>
          </View>
        )}
        {isSpeakerOn && (
          <View style={styles.indicator}>
            <Icon name="volume-up" size={16} color="#007AFF" />
            <Text style={styles.indicatorText}>Speaker On</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {isVideoMode ? (
        <View style={styles.videoContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: WEBRTC_URL }}
            style={styles.webview}
            onMessage={onWebViewMessage}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
          />
        </View>
      ) : (
        renderAudioCallUI()
      )}

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color="white"
          />
          <Text style={styles.controlLabel}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        {isVideoMode && (
          <TouchableOpacity
            style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
            onPress={toggleVideo}
          >
            <Icon
              name={isVideoEnabled ? 'videocam' : 'videocam-off'}
              size={24}
              color="white"
            />
            <Text style={styles.controlLabel}>
              {isVideoEnabled ? 'Stop Video' : 'Start Video'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={endCall}
        >
          <Icon name="call-end" size={24} color="white" />
          <Text style={[styles.controlLabel, styles.endCallLabel]}>
            End
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={toggleSpeaker}
        >
          <Icon
            name={isSpeakerOn ? 'volume-up' : 'volume-down'}
            size={24}
            color="white"
          />
          <Text style={styles.controlLabel}>
            {isSpeakerOn ? 'Speaker' : 'Phone'}
          </Text>
        </TouchableOpacity>
      </View>

      {!isCallConnected && isVideoMode && (
        <View style={styles.callingOverlay}>
          <Text style={styles.callingText}>Calling...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#4a4a4a',
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  callerInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  avatarContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  callerName: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  callStatus: {
    color: '#FF9500',
    fontSize: 18,
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  callStatusConnected: {
    color: '#34C759',
  },
  callDuration: {
    color: '#999',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 1,
  },
  statusIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    flexWrap: 'wrap',
    gap: 8,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 6,
  },
  indicatorText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButtonActive: {
    backgroundColor: '#007AFF',
  },
  controlLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  endCallLabel: {
    color: 'white',
    fontWeight: '600',
  },
  callingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callingText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
}); 