  void arrange_RGB(){
    int n;
    cin >> n ;
    char arr[n];
    for( int i = 0 ; i < n ; i++ ){
        cin >> arr[i];
    }
    int low = 0 , high = n-1 , mid = 0;
    while( mid <= high) {
        if( arr[mid] == 'R' ){
            swap( arr[low++] , arr[mid++] );
        }else if( arr[mid] == 'B' ){
            swap( arr[high] , arr[mid] );
            high --;
        }else{
            mid++;
        }
    }
    for( int i= 0; i < n ; i++ ){
        cout << arr[i] << " ";
    }
}
