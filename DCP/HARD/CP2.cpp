#include <bits/stdc++.h>
using namespace std;

int main() {
	int n;
	cin >> n ;
	int arr[n] , pref[n] , low[n];
	vector<int> v;
	for( int i = 0 ; i< n ; i++){
	    cin >> arr[i];
	}
	pref[0] = 1;
	for( int i = 1 ; i < n ; i++ ){
	    pref[i] = arr[i-1] * pref[i-1];
	}
	low[n-1] = 1;
	for( int i = n-2 ; i >= 0 ; i--){
	    low[i] = arr[i+1] * low[i+1];
	}
	for(int i = 0 ;i<n ;i++){
	    v.push_back(pref[i] * low[i]);
	}
	for(int i = 0 ; i < n ; i++){
	    cout << v[i] << " ";
	}
	return 0;
}
