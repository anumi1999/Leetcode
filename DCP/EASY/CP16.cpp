class DS{
    int[] circular_queue;
    int max_size;
    curr_ind;
public:
    DS(int n){
        this.max_size = n;
        this.circular_queue = new int[n];
        this.curr_ind = 0;
    }
    void record(int id){
        circular_queue[curr_ind] = id;
        curr_ind = (curr_ind + 1) % max_size;
    }
    int get_last(int i){
        return circular_queue[ (curr_ind - i + max_size) % max_size ];
    }
};
