void majority_element(){
    int n;
    cin >> n;
    int arr[n];
    for( int i = 0 ; i < n ; i++ ){
        cin >> arr[i];
    }
    unordered_map<int , int> m;
    for( int i = 0 ; i < n ; i++ ){
        m[arr[i]]++;
    }
    for( auto it = m.begin() ; it != m.end() ; it++){
        if( it->second == floor( n / 2 )){
            cout << it->first ;
            break;
        }
    }
}
