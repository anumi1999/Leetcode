void number_of_paths_to_destination(){
    int R , C;
    cin >> R >> C ;
    int arr[R][C];
    for( int i = 0 ; i < R ; i ++){
        for( int j = 0 ; j < C ; j++ ){
            cin >> arr[i][j];
            if( arr[i][j] == 1){
                arr[i][j] = -1;
            }
        }
    }
    for( int i = 0 ; i < R ; i++){
        if( arr[i][0] == 0)
            arr[i][0] = 1;
        else
            break;
    }
    for( int i = 1 ; i < C ; i++){
        if( arr[0][i] == 0)
            arr[0][i] = 1;
        else
            break;
    }
    for( int i = 1 ; i < R ; i++ ){
        for( int j = 1 ; j < C ; j++ ){
            if( arr[i][j] == -1)
                continue;
            if( arr[i-1][j] > 0 )
                arr[i][j] = arr[i-1][j] + arr[i][j];
            if( arr[i][j-1] > 0 )
                arr[i][j] = arr[i][j-1] + arr[i][j];
        }
    }
    for( int i = 0 ; i < R ; i ++){
        for( int j = 0 ; j < C ; j++ ){
            cout << arr[i][j] << " ";
        }
        cout << endl;
    }
    cout << arr[R-1][C-1];
}
