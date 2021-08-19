void squares_array(){
    int n;
    cin >> n;
    vector<int> v;
    for( int i = 0 ; i < n ; i++ ){
        int y;
        cin >> y;
        if( v.size() == 0){
            v.push_back(y*y);
        }
        else if( v[0] >= y*y ){
            v.insert(v.begin() , y*y );
        }else if( v[v.size() - 1] <= y * y ){
            v.push_back(y*y);
        }else{
            int low = 0 , high = v.size() - 1 , ans = 0;
            while( low < high ){
                int mid = low + (high - low)/2;
                if( v[mid] <= y*y ){
                    ans = low;
                    low = mid + 1;
                }else{
                    high = mid - 1;
                }
            }
            v.insert( v.begin()+low , y * y );
        }
    }
    for( auto i: v){
        cout << i << " ";
    }
}
