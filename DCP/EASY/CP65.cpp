void spiral(){
    int n , m;
    cin >> n >> m;
    int arr[m][n];
    for( int i = 0 ; i < m ; i++ ){
        for( int j = 0 ; j < n ; j++ ){
            cin >> arr[i][j];
        }
    }
    int i, k = 0, l = 0;
    while( k < m && l < n ){
        for( int i = l ; i < n ; i++ ){
            cout << arr[k][i] <<"\n";
        }
        k++;
        for( int i = k ; i < m ; i++ ){
            cout << arr[i][n-1] << "\n" ;
        }
        n--;
        if( k < m ){
            for( i = n - 1 ; i >= l ; i--){
                cout << arr[m-1][i] << "\n";
            }
            m--;
        }
        if( l < n ){
            for( int i = m - 1 ; i >= k ; i-- ){
                cout << arr[i][l] << "\n";
            }
            l++;
        }
    }
}
