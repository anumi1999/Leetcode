void running_median(){
    int n;
    cin >> n;
    vector<int> v;
    int y ;
    cin >> y ;
    v.push_back(y);
    cout << v[0];
    for( int i = 1; i < n ; i++ ){
        int m ;
        cin >> m ;
        if( v[0] >= m ){
            v.insert(v.begin() , m);
        }
        else if( v[v.size() - 1] <= m ){
            v.push_back(m);
        }else{
            int low = 0 , high = v.size() - 1 , ans = 0;
            while( low < high ){
                int mid = low + (high - low)/2;
                if( v[mid] <= m ){
                    ans = low;
                    low = mid + 1;
                }else{
                    high = mid - 1;
                }
            }
            v.insert( v.begin()+low , m);
        }
        if( v.size()%2 == 1)
            cout << v[v.size()/2] << " " ;
        else
            cout << (float)(v[v.size()/2] + v[(v.size()/2) - 1]) / 2 << " " ;
    }
}
