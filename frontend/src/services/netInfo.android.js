import NetInfo from '@react-native-community/netinfo';

export function addEventListener(callback) {
  return NetInfo.addEventListener(state => {
    callback({ isConnected: state.isConnected });
  });
}

export function fetch() {
  return NetInfo.fetch().then(state => ({
    isConnected: state.isConnected
  }));
}
