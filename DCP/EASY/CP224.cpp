#include<bits/stdc++.h>
using namespace std;

int main() {
	int n ;
	cin >> n ;
	int arr[n];
	for( int i = 0 ; i < n ; i++){
	    cin >> arr[i];
	}
	int k;
	cin >> k;
	set<int> sums;
	for( int i = 0 ; i < pow(2 , n) ; i++){
	    int sum = 0;
	    for( int j = 0 ; j < n ; j++ ){
	        if( i & ( 1 << j ) ){
	            sum += arr[j];
	        }
	    }
	    sums.insert(sum);
	}
    vector<int> v;
	for( auto s = sums.begin() ; s != sums.end() ; s++ ){
	    v.push_back( *s );
	}
	for( int i = 1 ; i < sums.size() ; i++ ){
	    if( v[i] - v[i-1] != 1 ){
	        cout << v[i-1] + 1;
	        break;
	    }
	}
	return 0;
}
