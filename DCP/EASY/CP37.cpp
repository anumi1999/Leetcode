void power_subset(){
    int n ;
    cin >> n;
    int arr[n];
    for( int i = 0 ; i < n ; i++ ){
        cin >> arr[i] ;
    }
    int pow_set_num = pow(2 , n);
    for( int i = 0 ; i < pow_set_num ; i++ ){
        for( int j = 0 ; j < n ; j++ ){
            if( i & (1 << j))
                cout << arr[j];
        }
        cout << endl;
    }
}
