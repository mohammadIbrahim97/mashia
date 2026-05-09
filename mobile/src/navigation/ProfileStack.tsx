import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '@screens/profile/ProfileScreen';
import { EditProfileScreen } from '@screens/profile/EditProfileScreen';
import { SettingsScreen } from '@screens/profile/SettingsScreen';
import { KycUploadScreen } from '@screens/profile/KycUploadScreen';
import { MyListingsScreen } from '@screens/listings/MyListingsScreen';
import { CreateListingScreen } from '@screens/listings/CreateListingScreen';
import { ListingDetailScreen } from '@screens/listings/ListingDetailScreen';
import { UploadCertificateScreen } from '@screens/certificates/UploadCertificateScreen';
import { CertificateDetailScreen } from '@screens/certificates/CertificateDetailScreen';

import { ProfileStackParamList } from './types';
export type { ProfileStackParamList };

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="KycUpload" component={KycUploadScreen} />
      <Stack.Screen name="MyListings" component={MyListingsScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="UploadCertificate" component={UploadCertificateScreen} />
      <Stack.Screen name="CertificateDetail" component={CertificateDetailScreen} />
    </Stack.Navigator>
  );
}
